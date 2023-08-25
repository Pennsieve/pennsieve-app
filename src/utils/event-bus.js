import emitter from 'tiny-emitter/instance'

const EventBus = {
    $emit: (...args) => emitter.emit(...args),
    $on: (...args) => emitter.on(...args),
    $off: (...args) => emitter.off(...args),
    $once: (...args) => emitter.once(...args),
}

export default EventBus