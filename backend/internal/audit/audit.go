package audit

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/Krea-University/noc-dashboard/backend/internal/database"
	"github.com/Krea-University/noc-dashboard/backend/internal/models"
)

// Service provides immutable audit logging operations.
type Service struct {
	db *database.DB
}

// NewService creates an audit service instance.
func NewService(db *database.DB) *Service {
	return &Service{db: db}
}

// Log writes an immutable audit record.
func (s *Service) Log(ctx context.Context, log *models.AuditLog) error {
	if log.ID == "" {
		log.ID = "aud_" + uuid.New().String()
	}
	if log.Timestamp.IsZero() {
		log.Timestamp = time.Now().UTC()
	}

	insertSQL := `
	INSERT INTO audit_logs (id, user_id, username, action, target_type, target_id, ip_address, user_agent, previous_state_json, new_state_json, result, reason, metadata_json, timestamp)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := s.db.ExecContext(ctx, insertSQL,
		log.ID, log.UserID, log.Username, log.Action, log.TargetType, log.TargetID,
		log.IPAddress, log.UserAgent, log.PreviousStateJSON, log.NewStateJSON,
		log.Result, log.Reason, log.MetadataJSON, log.Timestamp,
	)
	return err
}

// QueryLogs retrieves audit logs with optional filters (action, username) and pagination.
func (s *Service) QueryLogs(ctx context.Context, action, username string, limit, offset int) ([]models.AuditLog, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}

	query := `
	SELECT id, user_id, username, action, target_type, target_id, ip_address, user_agent, previous_state_json, new_state_json, result, reason, metadata_json, timestamp
	FROM audit_logs`
	var whereClauses []string
	var args []interface{}

	if action != "" {
		whereClauses = append(whereClauses, "action = ?")
		args = append(args, action)
	}

	if username != "" {
		whereClauses = append(whereClauses, "LOWER(username) = LOWER(?)")
		args = append(args, strings.TrimSpace(username))
	}

	if len(whereClauses) > 0 {
		query += " WHERE " + strings.Join(whereClauses, " AND ")
	}

	query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed querying audit logs: %w", err)
	}
	defer rows.Close()

	var logs []models.AuditLog
	for rows.Next() {
		var l models.AuditLog
		var targetType, targetID, ip, ua, prev, newS, reason, meta *string
		var userID *string

		err := rows.Scan(
			&l.ID, &userID, &l.Username, &l.Action, &targetType, &targetID,
			&ip, &ua, &prev, &newS, &l.Result, &reason, &meta, &l.Timestamp,
		)
		if err != nil {
			return nil, err
		}

		if userID != nil {
			l.UserID = *userID
		}
		if targetType != nil {
			l.TargetType = *targetType
		}
		if targetID != nil {
			l.TargetID = *targetID
		}
		if ip != nil {
			l.IPAddress = *ip
		}
		if ua != nil {
			l.UserAgent = *ua
		}
		if prev != nil {
			l.PreviousStateJSON = *prev
		}
		if newS != nil {
			l.NewStateJSON = *newS
		}
		if reason != nil {
			l.Reason = *reason
		}
		if meta != nil {
			l.MetadataJSON = *meta
		}

		logs = append(logs, l)
	}

	return logs, nil
}
