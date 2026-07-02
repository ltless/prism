package media

import (
	"github.com/ltless/prism/internal/api/config"
	"github.com/ltless/prism/internal/db"
	"github.com/ltless/prism/internal/vault"
)

type Service struct {
	pool     *db.TenantPool
	checker  config.ActiveChecker
	globalDB *db.GlobalDB
	pinLock  *vault.PinLock
}

func NewService(pool *db.TenantPool, checker config.ActiveChecker) *Service {
	return &Service{pool: pool, checker: checker}
}

func (s *Service) SetGlobalDB(g *db.GlobalDB) {
	s.globalDB = g
	s.pinLock = vault.NewPinLock(g.DB)
}
