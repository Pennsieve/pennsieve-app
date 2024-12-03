import striptags from "striptags";


export function useSanitize(html) {
    const allowedTags=['br']
    return striptags(html, allowedTags)
}