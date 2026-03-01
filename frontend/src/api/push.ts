import { apiClient } from './client'

export const pushApi = {
  getVapidPublicKey: async (): Promise<string> => {
    const res = await apiClient.get('/api/push/vapid-public-key')
    return res.data.data.public_key
  },

  subscribe: async (subscription: PushSubscriptionJSON): Promise<void> => {
    const keys = subscription.keys as { p256dh: string; auth: string }
    await apiClient.post('/api/push/subscribe', {
      endpoint: subscription.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: navigator.userAgent,
    })
  },

  unsubscribe: async (endpoint?: string): Promise<void> => {
    await apiClient.delete('/api/push/subscribe', {
      data: endpoint ? { endpoint } : {},
    })
  },
}

/** VAPID 공개키(base64url)를 Uint8Array로 변환한다. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/** 푸시 구독을 초기화한다. 이미 구독 중이면 서버에 재등록한다. */
export async function initPushSubscription(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  try {
    const registration = await navigator.serviceWorker.ready
    const vapidKey = await pushApi.getVapidPublicKey()
    const applicationServerKey = urlBase64ToUint8Array(vapidKey)

    let sub = await registration.pushManager.getSubscription()
    if (!sub) {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      })
    }
    await pushApi.subscribe(sub.toJSON() as PushSubscriptionJSON)
  } catch (e) {
    console.error('푸시 구독 초기화 실패:', e)
  }
}
