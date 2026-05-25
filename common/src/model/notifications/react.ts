import { useProject, useSignal } from '../foundation/react'
import type { Notification, NotificationService } from './NotificationService'

export function useNotificationService(): NotificationService {
    return useProject().notifications
}

export function useNotifications(): readonly Notification[] {
    return useSignal(useNotificationService().list)
}
