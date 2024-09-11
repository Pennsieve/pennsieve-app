// request_composable.js

import {compose, defaultTo, prop, propOr, tryCatch} from "ramda";
import EventBus from "@/utils/event-bus";
import {useHandleLogout} from "@/mixins/logout-handler/logout_handler_composable";
import {useRouter} from "vue-router";

const _isString = (x) => Object.prototype.toString.call(x) === '[object String]'

const _trimValues = (obj) => {
    Object.keys(obj).forEach(key => {
        if (_isString(obj[key])) {
            obj[key] = obj[key].trim()
        }
    })
}

/**
 * Send Xhr request
 * @param {string} url
 * @param {{method: string; header: {Authorization: string}; body: LinkedPropRequestBody[]}} opts  Error status
 * @param {string} opts.method
 * @param {Object} opts.header
 * @param {Object} opts.body
 */
export function useSendXhr(url, opts) {

    if (!url) {
        return Promise.reject({status: 400, message: 'Url is missing!'})
    }

    const method = propOr('GET', 'method', opts)

    const optsHeader = propOr({}, 'header', opts)
    const headers = Object.assign({}, { 'Content-type': 'application/json' }, optsHeader)

    console.log(opts)

    const optsBody = prop('body', opts)
    let requestOpts = { headers, method: method }

    if (optsBody) {
        if (typeof optsBody === 'object') {
            _trimValues(optsBody)
        }
        const body = JSON.stringify(optsBody)
        requestOpts = Object.assign({}, requestOpts, { body: body })
    } else {
        console.log("no opts body")
    }

    return fetch(url, requestOpts)
        .then(resp => {
            if (resp.status >= 400) {
                return Promise.reject(resp)
            }
            // if the payload cannot be converted to json, just return the original response
            return resp.json()
        })
}

/**
 * Handles ajax errors
 * @param {Object} err
 * @param {number} err.status  Error status
 * @param {ReadableStream} err.body Error body.
 */
export function useHandleXhrError(err) {
    const optionalStatus = prop('status', err)
    let status
    if (optionalStatus === undefined) {
        // emit ajaxError
        console.log(err)
        return
        // EventBus.$emit('ajaxError', err)
    } else {
        status = err.status
    }

    const router = useRouter()

    if (status === 400 && err.body) {
        err.body.getReader().read().then(({ done, value }) => {
            const strData = value instanceof Uint8Array ? String.fromCharCode.apply(null, value) : value
            const errorMsg = compose(defaultTo(strData), tryCatch(compose(prop('message'), JSON.parse), (_, v) => v))(strData)
            EventBus.$emit('ajaxError', {
                detail: {
                    type: 'error',
                    msg: errorMsg
                }
            })
        })
    } // logout
    else if (status === 401) {
        // debugger
        return useHandleLogout()
    } // unauthorized
    else if (status === 403) {
        return router.replace({name: 'datasets-list'})
    }
    else {
        // emit ajaxError
        EventBus.$emit('ajaxError', err)
    }
}