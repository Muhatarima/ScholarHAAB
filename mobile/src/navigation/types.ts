import type { Product } from '../types'

export type RootStackParamList = {
  MainTabs: undefined
  Chat:
    | {
        product?: Product
        sessionId?: string
      }
    | undefined
}

export type MainTabParamList = {
  Home: undefined
  History: undefined
  Settings: undefined
}
