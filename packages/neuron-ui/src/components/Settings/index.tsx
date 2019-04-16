import React from 'react'
import { NavLink } from 'react-router-dom'
import { Nav } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { Routes } from '../../utils/const'

const tabs = [
  { label: 'settings.settingtabs.general', to: Routes.SettingsGeneral },
  { label: 'settings.settingtabs.wallets', to: Routes.SettingsWallets },
  { label: 'settings.settingtabs.network', to: Routes.SettingsNetworks },
]

const Settings = () => {
  const [t] = useTranslation()
  return (
    <Nav variant="tabs">
      {tabs.map((tab, idx) => (
        <Nav.Item key={tab.label}>
          <NavLink
            className="nav-link"
            to={tab.to}
            isActive={(match, history) => {
              if (history.pathname === Routes.Settings && idx === 0) {
                return true
              }
              return !!match
            }}
          >
            {t(tab.label)}
          </NavLink>
        </Nav.Item>
      ))}
    </Nav>
  )
}

export default Settings
