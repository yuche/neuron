import { useEffect } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { NeuronWalletActions, StateDispatch, AppActions } from 'states/stateProvider/reducer'
import {
  updateTransactionList,
  updateCurrentWallet,
  updateWalletList,
  updateAddressListAndBalance,
  initAppState,
} from 'states/stateProvider/actionCreators'

import { getWinID } from 'services/remote'
import {
  DataUpdate as DataUpdateSubject,
  NetworkList as NetworkListSubject,
  CurrentNetworkID as CurrentNetworkIDSubject,
  ConnectionStatus as ConnectionStatusSubject,
  SyncStatus as SyncStatusSubject,
  Command as CommandSubject,
} from 'services/subjects'
import { ckbCore, getBlockchainInfo, getTipHeader } from 'services/chain'
import { networks as networksCache, currentNetworkID as currentNetworkIDCache } from 'services/localCache'
import { WalletWizardPath } from 'components/WalletWizard'
import { ErrorCode, RoutePath, getConnectionStatus } from 'utils'

const SYNC_INTERVAL_TIME = 4000
const CONNECTING_BUFFER = 15_000
let CONNECTING_DEADLINE = Date.now() + CONNECTING_BUFFER

const isCurrentUrl = (url: string) => {
  const id = currentNetworkIDCache.load()
  const list = networksCache.load()
  const cached = list.find(n => n.id === id)?.remote
  return cached === url
}

export const useSyncChainData = ({ chainURL, dispatch }: { chainURL: string; dispatch: StateDispatch }) => {
  useEffect(() => {
    let timer: NodeJS.Timeout
    const syncBlockchainInfo = () => {
      Promise.all([getTipHeader(), getBlockchainInfo()])
        .then(([header, chainInfo]) => {
          if (isCurrentUrl(chainURL)) {
            dispatch({
              type: AppActions.UpdateChainInfo,
              payload: {
                tipBlockNumber: `${BigInt(header.number)}`,
                tipBlockHash: header.hash,
                tipBlockTimestamp: +header.timestamp,
                chain: chainInfo.chain,
                difficulty: BigInt(chainInfo.difficulty),
                epoch: chainInfo.epoch,
              },
            })

            dispatch({
              type: AppActions.ClearNotificationsOfCode,
              payload: ErrorCode.NodeDisconnected,
            })
          }
        })
        .catch(() => {
          // ignore, unconnected events are handled in subscription
        })
    }
    clearInterval(timer!)
    if (chainURL) {
      ckbCore.setNode(chainURL)
      syncBlockchainInfo()
      timer = setInterval(() => {
        syncBlockchainInfo()
      }, SYNC_INTERVAL_TIME)
    } else {
      ckbCore.setNode('')
    }
    return () => {
      clearInterval(timer)
    }
  }, [chainURL, dispatch])
}

export const useOnCurrentWalletChange = ({
  walletID,
  history,
  dispatch,
}: {
  walletID: string
  chain: State.Chain
  history: ReturnType<typeof useHistory>

  dispatch: StateDispatch
}) => {
  useEffect(() => {
    initAppState()(dispatch, history)
  }, [walletID, dispatch, history])
}

export const useSubscription = ({
  walletID,
  chain,
  isAllowedToFetchList,
  history,
  dispatch,
  location,
}: {
  walletID: string
  chain: State.Chain
  isAllowedToFetchList: boolean
  history: ReturnType<typeof useHistory>
  location: ReturnType<typeof useLocation>
  dispatch: StateDispatch
}) => {
  const { pageNo, pageSize, keywords } = chain.transactions
  useEffect(() => {
    const dataUpdateSubscription = DataUpdateSubject.subscribe(({ dataType, walletID: walletIDOfMessage }: any) => {
      if (walletIDOfMessage && walletIDOfMessage !== walletID) {
        return
      }
      switch (dataType) {
        case 'address': {
          if (!isAllowedToFetchList) {
            break
          }
          updateAddressListAndBalance(walletID)(dispatch)
          break
        }
        case 'transaction': {
          if (!isAllowedToFetchList) {
            break
          }
          updateAddressListAndBalance(walletID)(dispatch)
          updateTransactionList({ walletID, keywords, pageNo, pageSize })(dispatch)
          break
        }
        case 'current-wallet': {
          updateCurrentWallet()(dispatch).then(hasCurrent => {
            if (!hasCurrent) {
              history.push(`${RoutePath.WalletWizard}${WalletWizardPath.Welcome}`)
            }
          })
          break
        }
        case 'wallets': {
          Promise.all([updateWalletList, updateCurrentWallet].map(request => request()(dispatch))).then(
            ([hasList, hasCurrent]) => {
              if (!hasList || !hasCurrent) {
                history.push(`${RoutePath.WalletWizard}${WalletWizardPath.Welcome}`)
              }
            }
          )
          break
        }
        default: {
          break
        }
      }
    })
    const networkListSubscription = NetworkListSubject.subscribe((currentNetworkList = []) => {
      dispatch({
        type: NeuronWalletActions.UpdateNetworkList,
        payload: currentNetworkList,
      })
      networksCache.save(currentNetworkList)
    })
    const currentNetworkIDSubscription = CurrentNetworkIDSubject.subscribe((currentNetworkID = '') => {
      dispatch({
        type: NeuronWalletActions.UpdateCurrentNetworkID,
        payload: currentNetworkID,
      })
      CONNECTING_DEADLINE = Date.now() + CONNECTING_BUFFER
      currentNetworkIDCache.save(currentNetworkID)
    })
    const connectionStatusSubscription = ConnectionStatusSubject.subscribe(status => {
      if (isCurrentUrl(status.url)) {
        dispatch({
          type: NeuronWalletActions.UpdateConnectionStatus,
          payload: getConnectionStatus({ ...status, isTimeout: Date.now() > CONNECTING_DEADLINE }),
        })
      }
    })

    const syncStatusSubscription = SyncStatusSubject.subscribe(
      ({ cacheTipNumber, bestKnownBlockNumber, bestKnownBlockTimestamp, estimate }) => {
        dispatch({
          type: NeuronWalletActions.UpdateSyncStatus,
          payload: {
            cacheTipBlockNumber: cacheTipNumber,
            bestKnownBlockNumber,
            bestKnownBlockTimestamp,
            estimate,
          },
        })
      }
    )

    const commandSubscription = CommandSubject.subscribe(({ winID, type, payload }: Subject.CommandMetaInfo) => {
      if (winID && getWinID() === winID) {
        switch (type) {
          // TODO: is this used anymore?
          case 'navigate-to-url': {
            if (payload) {
              history.push(payload)
            }
            break
          }
          case 'import-hardware': {
            if (payload) {
              history.push(location.pathname + payload)
            }
            break
          }
          case 'delete-wallet': {
            dispatch({
              type: AppActions.RequestPassword,
              payload: {
                walletID: payload || '',
                actionType: 'delete',
              },
            })
            break
          }
          case 'backup-wallet': {
            dispatch({
              type: AppActions.RequestPassword,
              payload: {
                walletID: payload || '',
                actionType: 'backup',
              },
            })
            break
          }
          case 'load-transaction-json': {
            if (payload) {
              const { url, json } = JSON.parse(payload)
              dispatch({
                type: AppActions.UpdateLoadedTransaction,
                payload: json,
              })
              history.push(location.pathname + url)
            }
            break
          }
          default: {
            break
          }
        }
      }
    })
    return () => {
      dataUpdateSubscription.unsubscribe()
      networkListSubscription.unsubscribe()
      currentNetworkIDSubscription.unsubscribe()
      connectionStatusSubscription.unsubscribe()
      syncStatusSubscription.unsubscribe()
      commandSubscription.unsubscribe()
    }
  }, [walletID, pageNo, pageSize, keywords, isAllowedToFetchList, history, dispatch, location.pathname])
}

export default {
  useSyncChainData,
  useOnCurrentWalletChange,
  useSubscription,
}
