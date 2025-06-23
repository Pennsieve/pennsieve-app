// utils/throttle.js
export function createThrottle(func, wait, options = {}) {
    let context
    let args
    let result
    let timeout = null
    let previous = 0

    const { leading = true, trailing = true } = options

    const later = function() {
        previous = leading === false ? 0 : Date.now()
        timeout = null
        result = func.apply(context, args)
        if (!timeout) context = args = null
    }

    const throttled = function() {
        const now = Date.now()
        if (!previous && leading === false) previous = now

        const remaining = wait - (now - previous)
        context = this
        args = arguments

        if (remaining <= 0 || remaining > wait) {
            if (timeout) {
                clearTimeout(timeout)
                timeout = null
            }
            previous = now
            result = func.apply(context, args)
            if (!timeout) context = args = null
        } else if (!timeout && trailing !== false) {
            timeout = setTimeout(later, remaining)
        }

        return result
    }

    throttled.cancel = function() {
        clearTimeout(timeout)
        previous = 0
        timeout = context = args = null
    }

    return throttled
}