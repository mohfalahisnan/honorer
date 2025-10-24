import type { Context } from 'hono'

export type PaginationInfo = {
	page: number
	limit: number
	total?: number
	pageCount?: number
	hasNext?: boolean
	hasPrev?: boolean
}

export type ResponseEnvelope<T = any> = {
	status: number
	success: boolean
	data: T | T[] | null
	pagination?: PaginationInfo
	code?: string
	message?: string
	meta?: Record<string, any>
}

export class ApiResponse<T = any> {
	private envelope: ResponseEnvelope<T>

	constructor(envelope: ResponseEnvelope<T>) {
		this.envelope = envelope
	}

	static success<T = any>(
		data: T | T[] | null,
		options?: {
			status?: number
			message?: string
			code?: string
			meta?: Record<string, any>
			pagination?: PaginationInfo
		},
	): ApiResponse<T> {
		const status = options?.status ?? 200
		return new ApiResponse<T>({
			status,
			success: status >= 200 && status < 300,
			data,
			message: options?.message,
			code: options?.code,
			pagination: options?.pagination,
			meta: options?.meta,
		})
	}

	static error<T = any>(
		message: string,
		options?: { status?: number; code?: string; meta?: Record<string, any>; data?: T | T[] | null },
	): ApiResponse<T> {
		const status = options?.status ?? 400
		return new ApiResponse<T>({
			status,
			success: false,
			data: options?.data ?? null,
			message,
			code: options?.code,
			meta: options?.meta,
		})
	}

	static paginated<T = any>(
		data: T[],
		pagination: PaginationInfo,
		options?: { status?: number; message?: string; code?: string; meta?: Record<string, any> },
	): ApiResponse<T> {
		const status = options?.status ?? 200
		return new ApiResponse<T>({
			status,
			success: status >= 200 && status < 300,
			data,
			pagination,
			message: options?.message,
			code: options?.code,
			meta: options?.meta,
		})
	}

	toJSON(): ResponseEnvelope<T> {
		return this.envelope
	}

	toResponse(c: Context): Response {
		return c.json(this.envelope, this.envelope.status as any)
	}
}

function isResponseEnvelope(obj: any): obj is ResponseEnvelope<any> {
	if (!obj || typeof obj !== 'object') return false
	if (typeof obj.status !== 'number') return false
	if (typeof obj.success !== 'boolean') return false
	// data may be null; check presence rather than type strictness
	if (!Object.hasOwn(obj, 'data')) return false
	return true
}

export async function formatReturn(c: Context, result: any): Promise<Response> {
	// If a Response was manually created, try to normalize JSON bodies
	if (result instanceof Response) {
		const ct = result.headers?.get('content-type') || ''
		if (ct.includes('application/json')) {
			try {
				const payload = await result.clone().json()
				if (isResponseEnvelope(payload)) {
					return result // already formatted
				}
				if (result.ok) {
					return ApiResponse.success(payload ?? null, { status: result.status }).toResponse(c)
				}
				const message = typeof payload === 'string' ? payload : (payload?.message ?? 'Error')
				return ApiResponse.error(message, { status: result.status, data: payload ?? null }).toResponse(c)
			} catch {
				// not JSON or failed to parse; pass through
				return result
			}
		}
		return result
	}

	// ApiResponse -> use defined envelope
	if (result instanceof ApiResponse) {
		return result.toResponse(c)
	}

	// Normalize plain values/arrays
	return ApiResponse.success(result ?? null).toResponse(c)
}
