import { z } from 'zod'

export const ApiErrorSchema = z.object({
    error: z.string(),
})
export type ApiErrorBody = z.infer<typeof ApiErrorSchema>

export class ApiError extends Error {
    readonly status: number

    constructor(status: number, message: string) {
        super(message)
        this.name = 'ApiError'
        this.status = status
    }

    static async fromResponse(response: Response): Promise<ApiError> {
        let message = response.statusText || `HTTP ${response.status}`
        try {
            const text = await response.text()
            if (text) {
                const parsed = ApiErrorSchema.safeParse(JSON.parse(text))
                if (parsed.success) message = parsed.data.error
            }
        } catch {
            // fall through; keep statusText
        }
        return new ApiError(response.status, message)
    }
}
