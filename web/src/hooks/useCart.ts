import { useEffect, useState } from 'react'

export interface CartItem {
	productId: string
	quantity: number
}

export interface Cart {
	id: string
	items: CartItem[]
}

interface UseCartState {
	data: Cart | null
	loading: boolean
	error: Error | null
}

export function useCart(userId: string): UseCartState {
	const [data, setData] = useState<Cart | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<Error | null>(null)

	useEffect(() => {
		async function fetchCart() {
			try {
				setLoading(true)
				setError(null)

				// const response = await fetch(`/api/users/${userId}/cart`)

				// if (!response.ok) {
				// throw new Error('Failed to fetch cart')
				// }

				// const cart: Cart = await response.json()

				// setData(cart)
			} catch (err) {
				setError(err instanceof Error ? err : new Error('Unknown error'))
			} finally {
				setLoading(false)
			}
		}

		fetchCart()
	}, [userId])

	return { data, loading, error }
}
