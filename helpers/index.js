/**
 * Returns object of objects from `src`, the keys of which are values of `key`
 *
 * @param src array
 * @param key string
 */
exports.keyBy = (src, key) => {
    return src.reduce((acc, item) => {
        acc[item[key]] = item;
        return acc;
    }, {});
};
