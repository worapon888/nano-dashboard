import axios from 'axios'
import { apiClient } from './api'

export interface ManagedUser {
  id: string
  email: string
  displayName: string
  role: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type UsersListResponse = {
  success: true
  data: ManagedUser[]
}

type UserResponse = {
  success: true
  data: ManagedUser
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  }
}

function normalizeUsersError(error: unknown): Error {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error : new Error('Unable to update user right now.')
  }

  if (error.code === 'ERR_NETWORK' || !error.response) {
    return new Error(
      'Network error. Check that the backend is reachable and that CORS allows this origin.',
    )
  }

  const status = error.response.status
  const message = error.response.data?.message
  const normalizedMessage = Array.isArray(message) ? message.join(', ') : message

  if (status === 401) {
    return new Error('Session expired. Please sign in again.')
  }

  if (status === 403) {
    return new Error('You do not have permission to update this user.')
  }

  if (status === 404) {
    return new Error('User not found.')
  }

  if (status === 400) {
    return new Error('Please check your profile details and try again.')
  }

  if (typeof normalizedMessage === 'string' && normalizedMessage.trim().length > 0) {
    return new Error(normalizedMessage)
  }

  return new Error('Unable to update user right now.')
}

export async function listUsers(token: string): Promise<ManagedUser[]> {
  try {
    const response = await apiClient.get<UsersListResponse>('/users', {
      headers: authHeaders(token),
      params: {
        page: 1,
        limit: 12,
      },
    })

    return Array.isArray(response.data.data) ? response.data.data : []
  } catch (error) {
    throw normalizeUsersError(error)
  }
}

export async function updateUserDisplayName(
  token: string,
  userId: string,
  displayName: string,
): Promise<ManagedUser> {
  try {
    const response = await apiClient.patch<UserResponse>(
      `/users/${userId}`,
      { displayName },
      {
        headers: authHeaders(token),
      },
    )

    return response.data.data
  } catch (error) {
    throw normalizeUsersError(error)
  }
}

export async function softDeleteUser(token: string, userId: string): Promise<void> {
  try {
    await apiClient.delete(`/users/${userId}`, {
      headers: authHeaders(token),
    })
  } catch (error) {
    throw normalizeUsersError(error)
  }
}
