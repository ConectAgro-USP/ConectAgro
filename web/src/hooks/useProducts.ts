import { useEffect, useState } from 'react'

export interface Product {
	id: string
	name: string
	price: number
}

interface UseProductsState {
	data: Product[]
	loading: boolean
	error: Error | null
}

export function useProducts(): UseProductsState {
	const [data, setData] = useState<Product[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<Error | null>(null)

	useEffect(() => {
		async function fetchProducts() {
			try {
				setLoading(true)
				setError(null)

				// const response = await fetch('/api/products')

				// if (!response.ok) {
				// 	throw new Error('Failed to fetch products')
				// }

				// const products: Product[] = await response.json()

				// setData(products)
			} catch (err) {
				setError(err instanceof Error ? err : new Error('Unknown error'))
			} finally {
				setLoading(false)
			}
		}

		fetchProducts()
	}, [])

	return { data, loading, error }
}
