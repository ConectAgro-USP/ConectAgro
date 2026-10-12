import { useEffect, useState } from 'react'

export interface User {
	id: string
	name: string
	email: string
}

interface UseUserState {
	data: User | null
	loading: boolean
	error: Error | null
}

export function useUser(userId: string): UseUserState {
	const [data, setData] = useState<User | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<Error | null>(null)

	useEffect(() => {
		async function fetchUser() {
			try {
				setLoading(true)
				setError(null)

				// const response = await fetch(`/api/users/${userId}`)

				// if (!response.ok) {
				// 	throw new Error('Failed to fetch user')
				// }

				// const user: User = await response.json()

				// setData(user)
			} catch (err) {
				setError(err instanceof Error ? err : new Error('Unknown error'))
			} finally {
				setLoading(false)
			}
		}

		fetchUser()
	}, [userId])

	return { data, loading, error }
}
