package rbac_test

import (
	"testing"

	"github.com/Krea-University/noc-dashboard/backend/internal/models"
	"github.com/Krea-University/noc-dashboard/backend/internal/rbac"
)

func TestRBACPermissions(t *testing.T) {
	adminUser := &models.User{
		ID:       "usr_admin",
		Username: "admin",
		RoleName: "ADMINISTRATOR",
	}

	operatorUser := &models.User{
		ID:          "usr_op",
		Username:    "operator",
		RoleName:    "OPERATOR",
		Permissions: []string{"dashboard.view", "alarms.acknowledge", "incidents.manage"},
	}

	netOpUser := &models.User{
		ID:          "usr_net_op",
		Username:    "net_operator",
		RoleName:    "NETWORK_OPERATOR",
		Permissions: []string{"dashboard.view", "vlan.internet.disable", "vlan.internet.enable"},
	}

	viewerUser := &models.User{
		ID:          "usr_viewer",
		Username:    "viewer",
		RoleName:    "VIEWER",
		Permissions: []string{"dashboard.view", "devices.view"},
	}

	// 1. Admin has everything implicitly
	if !rbac.HasPermission(adminUser, "vlan.internet.disable") {
		t.Errorf("expected admin to have vlan.internet.disable")
	}
	if !rbac.HasPermission(adminUser, "any.unknown.permission") {
		t.Errorf("expected admin to have all permissions")
	}

	// 2. Operator has alarms.acknowledge but not vlan.internet.disable
	if !rbac.HasPermission(operatorUser, "alarms.acknowledge") {
		t.Errorf("expected operator to have alarms.acknowledge")
	}
	if rbac.HasPermission(operatorUser, "vlan.internet.disable") {
		t.Errorf("operator should NOT have vlan.internet.disable")
	}

	// 3. Network Operator has vlan.internet.disable
	if !rbac.HasPermission(netOpUser, "vlan.internet.disable") {
		t.Errorf("expected network operator to have vlan.internet.disable")
	}

	// 4. Viewer cannot acknowledge alarms or toggle VLAN
	if rbac.HasPermission(viewerUser, "alarms.acknowledge") {
		t.Errorf("viewer should NOT have alarms.acknowledge")
	}
	if rbac.HasPermission(viewerUser, "vlan.internet.disable") {
		t.Errorf("viewer should NOT have vlan.internet.disable")
	}
}
