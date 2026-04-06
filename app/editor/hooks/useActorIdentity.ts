'use client'

import { useCallback, useEffect, useState } from 'react'

const ACTOR_STORAGE_KEY = 'printed.actor-profile.v1'

type ActorProfile = {
  actorClientId: string
  actorName: string
}

export function useActorIdentity() {
  const [actorProfile, setActorProfile] = useState<ActorProfile | null>(null)
  const [actorDraftName, setActorDraftName] = useState('')
  const [actorDialogError, setActorDialogError] = useState<string | null>(null)
  const [isActorDialogOpen, setIsActorDialogOpen] = useState(false)

  const actorName = actorProfile?.actorName ?? ''
  const actorClientId = actorProfile?.actorClientId ?? ''

  useEffect(() => {
    const storedValue = localStorage.getItem(ACTOR_STORAGE_KEY)

    if (!storedValue) {
      const fallbackProfile = { actorClientId: crypto.randomUUID(), actorName: '' }
      setActorProfile(fallbackProfile)
      setActorDraftName('')
      setIsActorDialogOpen(true)
      return
    }

    try {
      const parsed = JSON.parse(storedValue) as Partial<ActorProfile>
      const nextProfile = {
        actorClientId: parsed.actorClientId?.trim() || crypto.randomUUID(),
        actorName: parsed.actorName?.trim() || '',
      }
      setActorProfile(nextProfile)
      setActorDraftName(nextProfile.actorName)

      if (!nextProfile.actorName) {
        setIsActorDialogOpen(true)
      } else if (
        parsed.actorClientId?.trim() !== nextProfile.actorClientId ||
        parsed.actorName?.trim() !== nextProfile.actorName
      ) {
        localStorage.setItem(ACTOR_STORAGE_KEY, JSON.stringify(nextProfile))
      }
    } catch {
      const fallbackProfile = { actorClientId: crypto.randomUUID(), actorName: '' }
      setActorProfile(fallbackProfile)
      setActorDraftName('')
      setIsActorDialogOpen(true)
      localStorage.setItem(ACTOR_STORAGE_KEY, JSON.stringify(fallbackProfile))
    }
  }, [])

  const saveActorProfile = useCallback((nextName: string) => {
    const trimmedName = nextName.trim()
    if (!trimmedName) {
      setActorDialogError('작업자 이름을 입력해주세요.')
      return false
    }
    const nextProfile = {
      actorName: trimmedName,
      actorClientId: actorClientId || crypto.randomUUID(),
    }
    localStorage.setItem(ACTOR_STORAGE_KEY, JSON.stringify(nextProfile))
    setActorProfile(nextProfile)
    setActorDraftName(trimmedName)
    setActorDialogError(null)
    setIsActorDialogOpen(false)
    return true
  }, [actorClientId])

  const ensureActorProfile = useCallback(() => {
    if (actorName.trim()) return true
    setActorDraftName(prev => prev || actorName)
    setActorDialogError('저장과 내보내기 전에 작업자 이름을 먼저 설정해주세요.')
    setIsActorDialogOpen(true)
    return false
  }, [actorName])

  return {
    actorName,
    actorClientId,
    actorDraftName,
    setActorDraftName,
    actorDialogError,
    setActorDialogError,
    isActorDialogOpen,
    setIsActorDialogOpen,
    saveActorProfile,
    ensureActorProfile,
  }
}
