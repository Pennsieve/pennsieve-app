import { HttpResponse, http } from 'msw'

export const handlers = [
    http.get('https://test.pennsieve.net', () => {
        return HttpResponse.json({status: 200})
    }),
    http.get('https://test.pennsieve.net/error', () => {
        return HttpResponse.json({status: 500})
    }),
    http.post('https://test.pennsieve.net', () => {
        return HttpResponse.json({status: 200})
    }),
    http.delete('https://test.pennsieve.net/delete/unauth', () => {
        return HttpResponse.json({'status': 403})
    }),
    http.get('https://app.blackfynn.net/organizations/777/teams/17', () => {
        return HttpResponse.json({status: 200})
    }),
    http.get('https://app.blackfynn.net/organizations/1/teams/17', () => {
        return HttpResponse.json({status: 200})
    }),
    http.get('https://app.blackfynn.net/organizations/777/teams/17/members', () => {
        return HttpResponse.json({status: 200})
    }),
    http.get('https://app.blackfynn.net/organizations/1/teams/17/members', () => {
        return HttpResponse.json({status: 200})
    }),





]
