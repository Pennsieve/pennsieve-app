// fileIcon.js
// This should provide the same functionality as the index.js function but rewritten to support the composition API

import * as files from '../../supported-files/files.json'
import { compose, concat, propOr, useWith, find, propEq } from 'ramda'

/**
 * Lookup the svg per icon key
 * @param {String} icon
 * @param {Array} files
 * @returns {String}
 */
const getSvgIcon = compose(
    concat('/file-icons/'),
    propOr('icon-generic.svg', 'SVG'),
    useWith(find, [propEq('Icon')])
)

/**    * Get the svg image
* @param {String} icon
* @param {String} packageType
* @returns {String}
*/
export function fileIcon(icon, packageType) {
    if (packageType === 'Collection') {
        return '/file-icons/icon-folder.svg'
    }

    if (packageType === 'ExternalFile') {
        return '/file-icons/icon-linked-file.svg'
    }

    const list = Array.isArray(files) ? files : files.default
    return getSvgIcon(icon, list)
}