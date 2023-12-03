import { HttpResponse, http } from 'msw'

export const handlers = [
    http.get('https://test.pennsieve.net', () => {
        console.log('Captured a "GET /posts" request')
        return HttpResponse.json({status: 200})
    }),
    http.post('https://test.pennsieve.net', () => {
        console.log('Captured a "POST /posts" request')
        return HttpResponse.json({status: 200})
    }),
    http.delete('https://test.pennsieve.net/delete/unauth', () => {
        console.log('Captured a "DELETE /unauth" request')
        return HttpResponse.json({'status': 403})
    })
]
