import React from 'react'
import styled from 'styled-components'
import { Routes } from '../../utils/const'

const TabBarPenal = styled.div`
  display: flex;
  flex-direction: row;
`

const TabItem = styled.div`
  width: 200px;
  height: 40px;
  border-radius: 10px;
  text-align: center;
  line-height: 60px;
  color: black;
`
const TabBar = (props: any) => {
  return (
    <TabBarPenal>
      <TabItem
        onClick={() => {
          props.history.push(Routes.SettingsGeneral)
        }}
      >
        General
      </TabItem>
      <TabItem
        onClick={() => {
          props.history.push(Routes.SettingsWallets)
        }}
      >
        Wallets
      </TabItem>
      <TabItem
        onClick={() => {
          props.history.push(Routes.SettingsNetwork)
        }}
      >
        Network
      </TabItem>
    </TabBarPenal>
  )
}

export default TabBar
