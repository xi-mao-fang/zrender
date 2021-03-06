define(function (require) {

    var util = require('../core/util');
    var BoundingRect = require('../core/BoundingRect');

    var textWidthCache = {};
    var textWidthCacheCounter = 0;

    var TEXT_CACHE_MAX = 5000;
    var STYLE_REG = /\{([a-zA-Z0-9_]+)\|([^}]*)\}/g;
    var DEFAULT_FONT = '12px sans-serif';

    var retrieve2 = util.retrieve2;
    var retrieve3 = util.retrieve3;

    /**
     * @public
     * @param {string} text
     * @param {string} font
     * @return {number} width
     */
    function getTextWidth(text, font) {
        font = font || DEFAULT_FONT;
        var key = text + ':' + font;
        if (textWidthCache[key]) {
            return textWidthCache[key];
        }

        var textLines = (text + '').split('\n');
        var width = 0;

        for (var i = 0, l = textLines.length; i < l; i++) {
            // textContain.measureText may be overrided in SVG or VML
            width = Math.max(textContain.measureText(textLines[i], font).width, width);
        }

        if (textWidthCacheCounter > TEXT_CACHE_MAX) {
            textWidthCacheCounter = 0;
            textWidthCache = {};
        }
        textWidthCacheCounter++;
        textWidthCache[key] = width;

        return width;
    }

    /**
     * @public
     * @param {string} text
     * @param {string} font
     * @param {string} [textAlign='left']
     * @param {string} [textVerticalAlign='top']
     * @param {Array.<number>} [textPadding]
     * @param {Object} [rich]
     * @return {Object} {x, y, width, height, lineHeight}
     */
    function getTextRect(text, font, textAlign, textVerticalAlign, textPadding, rich) {
        return rich
            ? getRichTextRect(text, font, textAlign, textVerticalAlign, textPadding, rich)
            : getPlainTextRect(text, font, textAlign, textVerticalAlign, textPadding);
    }

    function getPlainTextRect(text, font, textAlign, textVerticalAlign, textPadding) {
        var contentBlock = parsePlainText(text, font, textVerticalAlign);
        var outerWidth = getTextWidth(text, font);
        var outerHeight = contentBlock.height;

        if (textPadding) {
            outerWidth += textPadding[1] + textPadding[3];
            outerHeight += textPadding[0] + textPadding[2];
        }

        var x = adjustTextX(0, outerWidth, textAlign);
        var y = adjustTextY(0, outerHeight, textVerticalAlign);

        var rect = new BoundingRect(x, y, outerWidth, outerHeight);
        rect.lineHeight = contentBlock.lineHeight;

        return rect;
    }

    function getRichTextRect(text, font, textAlign, textVerticalAlign, textPadding, rich) {
        var contentBlock = parseRichText(text, {
            rich: rich,
            font: font,
            textAlign: textAlign,
            textPadding: textPadding
        });
        var outerWidth = contentBlock.outerWidth;
        var outerHeight = contentBlock.outerHeight;

        var x = adjustTextX(0, outerWidth, textAlign);
        var y = adjustTextY(0, outerHeight, textVerticalAlign);

        return new BoundingRect(x, y, outerWidth, outerHeight);
    }

    /**
     * @public
     * @param {number} x
     * @param {number} width
     * @param {string} [textAlign='left']
     * @return {number} Adjusted x.
     */
    function adjustTextX(x, width, textAlign) {
        // FIXME Right to left language
        if (textAlign === 'right') {
            x -= width;
        }
        else if (textAlign === 'center') {
            x -= width / 2;
        }
        return x;
    }

    /**
     * @public
     * @param {number} y
     * @param {number} height
     * @param {string} [textVerticalAlign='top']
     * @return {number} Adjusted y.
     */
    function adjustTextY(y, height, textVerticalAlign) {
        if (textVerticalAlign === 'middle') {
            y -= height / 2;
        }
        else if (textVerticalAlign === 'bottom') {
            y -= height;
        }
        return y;
    }

    /**
     * @public
     * @param {stirng} textPosition
     * @param {Object} rect {x, y, width, height}
     * @param {number} distance
     * @return {Object} {x, y, textAlign, textVerticalAlign}
     */
    function adjustTextPositionOnRect(textPosition, rect, distance) {

        var x = rect.x;
        var y = rect.y;

        var height = rect.height;
        var width = rect.width;
        var halfHeight = height / 2;

        var textAlign = 'left';
        var textVerticalAlign = 'top';

        switch (textPosition) {
            case 'left':
                x -= distance;
                y += halfHeight;
                textAlign = 'right';
                textVerticalAlign = 'middle';
                break;
            case 'right':
                x += distance + width;
                y += halfHeight;
                textVerticalAlign = 'middle';
                break;
            case 'top':
                x += width / 2;
                y -= distance;
                textAlign = 'center';
                textVerticalAlign = 'bottom';
                break;
            case 'bottom':
                x += width / 2;
                y += height + distance;
                textAlign = 'center';
                break;
            case 'inside':
                x += width / 2;
                y += halfHeight;
                textAlign = 'center';
                textVerticalAlign = 'middle';
                break;
            case 'insideLeft':
                x += distance;
                y += halfHeight;
                textVerticalAlign = 'middle';
                break;
            case 'insideRight':
                x += width - distance;
                y += halfHeight;
                textAlign = 'right';
                textVerticalAlign = 'middle';
                break;
            case 'insideTop':
                x += width / 2;
                y += distance;
                textAlign = 'center';
                break;
            case 'insideBottom':
                x += width / 2;
                y += height - distance;
                textAlign = 'center';
                textVerticalAlign = 'bottom';
                break;
            case 'insideTopLeft':
                x += distance;
                y += distance;
                break;
            case 'insideTopRight':
                x += width - distance;
                y += distance;
                textAlign = 'right';
                break;
            case 'insideBottomLeft':
                x += distance;
                y += height - distance;
                textVerticalAlign = 'bottom';
                break;
            case 'insideBottomRight':
                x += width - distance;
                y += height - distance;
                textAlign = 'right';
                textVerticalAlign = 'bottom';
                break;
        }

        return {
            x: x,
            y: y,
            textAlign: textAlign,
            textVerticalAlign: textVerticalAlign
        };
    }

    /**
     * Show ellipsis if overflow.
     *
     * @public
     * @param  {string} text
     * @param  {string} containerWidth
     * @param  {string} font
     * @param  {number} [ellipsis='...']
     * @param  {Object} [options]
     * @param  {number} [options.maxIterations=3]
     * @param  {number} [options.minChar=0] If truncate result are less
     *                  then minChar, ellipsis will not show, which is
     *                  better for user hint in some cases.
     * @param  {number} [options.placeholder=''] When all truncated, use the placeholder.
     * @return {string}
     */
    function truncateText(text, containerWidth, font, ellipsis, options) {
        if (!containerWidth) {
            return '';
        }

        options = options || {};

        ellipsis = retrieve2(ellipsis, '...');
        var maxIterations = retrieve2(options.maxIterations, 2);
        var minChar = retrieve2(options.minChar, 0);
        // FIXME
        // Other languages?
        var cnCharWidth = getTextWidth('国', font);
        // FIXME
        // Consider proportional font?
        var ascCharWidth = getTextWidth('a', font);
        var placeholder = retrieve2(options.placeholder, '');

        // Example 1: minChar: 3, text: 'asdfzxcv', truncate result: 'asdf', but not: 'a...'.
        // Example 2: minChar: 3, text: '维度', truncate result: '维', but not: '...'.
        var contentWidth = containerWidth = Math.max(0, containerWidth - 1); // Reserve some gap.
        for (var i = 0; i < minChar && contentWidth >= ascCharWidth; i++) {
            contentWidth -= ascCharWidth;
        }

        var ellipsisWidth = getTextWidth(ellipsis);
        if (ellipsisWidth > contentWidth) {
            ellipsis = '';
            ellipsisWidth = 0;
        }

        contentWidth = containerWidth - ellipsisWidth;

        var textLines = (text + '').split('\n');

        for (var i = 0, len = textLines.length; i < len; i++) {
            var textLine = textLines[i];
            var lineWidth = getTextWidth(textLine, font);

            if (lineWidth <= containerWidth) {
                continue;
            }

            for (var j = 0;; j++) {
                if (lineWidth <= contentWidth || j >= maxIterations) {
                    textLine += ellipsis;
                    break;
                }

                var subLength = j === 0
                    ? estimateLength(textLine, contentWidth, ascCharWidth, cnCharWidth)
                    : lineWidth > 0
                    ? Math.floor(textLine.length * contentWidth / lineWidth)
                    : 0;

                textLine = textLine.substr(0, subLength);
                lineWidth = getTextWidth(textLine, font);
            }

            if (textLine === '') {
                textLine = placeholder;
            }

            textLines[i] = textLine;
        }

        return textLines.join('\n');
    }

    function estimateLength(text, contentWidth, ascCharWidth, cnCharWidth) {
        var width = 0;
        var i = 0;
        for (var len = text.length; i < len && width < contentWidth; i++) {
            var charCode = text.charCodeAt(i);
            width += (0 <= charCode && charCode <= 127) ? ascCharWidth : cnCharWidth;
        }
        return i;
    }

    /**
     * @public
     * @param {string} font
     * @return {number} line height
     */
    function getLineHeight(font) {
        // FIXME A rough approach.
        return getTextWidth('国', font);
    }

    /**
     * @public
     * @param {string} text
     * @param {string} font
     * @return {Object} width
     */
    function measureText(text, font) {
        var ctx = util.getContext();
        ctx.font = font || DEFAULT_FONT;
        return ctx.measureText(text);
    }

    /**
     * @public
     * @param {string} text
     * @param {string} font
     * @return {Object} block: {lineHeight, lines, height}
     */
    function parsePlainText(text, font) {
        var lines = (text + '').split('\n');
        var lineHeight = getLineHeight(font);
        var height = lines.length * lineHeight;
        var y = 0;

        return {
            lines: lines,
            height: height,
            lineHeight: lineHeight,
            y: y
        };
    }

    /**
     * For example: 'some text {a|some text}other text{b|some text}xxx{c|}xxx'
     * Also consider 'bbbb{a|xxx\nzzz}xxxx\naaaa'.
     *
     * @public
     * @param {string} text
     * @param {Object} style
     * @param {Object} style.rich Styles of rich text.
     * @param {string} [style.font]
     * @param {string} [style.textAlign]
     * @return {Object} block
     * {
     *      width,
     *      height,
     *      lines: [{
     *          lineHeight,
     *          width,
     *          tokens: [[{
     *              styleName,
     *              text,
     *              width,      // include textPadding
     *              height,     // include textPadding
     *              textWidth, // pure text width
     *              textHeight, // pure text height
     *              lineHeihgt,
     *              font,
     *              textAlign,
     *              textVerticalAlign
     *          }], [...], ...]
     *      }, ...]
     * }
     * If styleName is undefined, it is plain text.
     */
    function parseRichText(text, style) {
        var contentBlock = {lines: [], width: 0, height: 0};

        text != null && (text += '');
        if (!text) {
            return contentBlock;
        }

        var lastIndex = STYLE_REG.lastIndex = 0;
        var result;
        while ((result = STYLE_REG.exec(text)) != null)  {
            var matchedIndex = result.index;
            if (matchedIndex > lastIndex) {
                pushTokens(contentBlock, text.substring(lastIndex, matchedIndex));
            }
            pushTokens(contentBlock, result[2], result[1]);
            lastIndex = STYLE_REG.lastIndex;
        }

        if (lastIndex < text.length) {
            pushTokens(contentBlock, text.substring(lastIndex, text.length));
        }

        var lines = contentBlock.lines;
        var contentHeight = 0;
        var contentWidth = 0;

        // Calculate layout info of tokens.
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            var lineHeight = 0;
            var lineWidth = 0;

            for (var j = 0; j < line.tokens.length; j++) {
                var token = line.tokens[j];
                var tokenStyle = style.rich[token.styleName] || {};
                // textPadding should not inherit from style.
                var textPadding = token.textPadding = tokenStyle.textPadding;

                // textFont has been asigned to font by `normalizeStyle`.
                var font = token.font = tokenStyle.font || style.font;

                // textHeight can be used when textVerticalAlign is specified in token.
                var textHeight = token.textHeight = retrieve2(
                    // textHeight should not be inherited, consider it can be specified
                    // as box height of the block.
                    tokenStyle.textHeight, textContain.getLineHeight(font)
                );
                textPadding && (textHeight += textPadding[0] + textPadding[2]);
                token.height = textHeight;
                token.lineHeight = retrieve3(
                    tokenStyle.textLineHeight, style.textLineHeight, textHeight
                );

                token.textAlign = tokenStyle && tokenStyle.textAlign || style.textAlign;
                token.textVerticalAlign = tokenStyle && tokenStyle.textVerticalAlign || 'middle';

                var textWidth = token.textWidth = textContain.getWidth(token.text, font);
                var tokenWidth = tokenStyle.textWidth;
                if (tokenWidth == null || tokenWidth === 'auto') {
                    tokenWidth = textWidth;
                    textPadding && (tokenWidth += textPadding[1] + textPadding[3]);
                }
                lineWidth += (token.width = tokenWidth);
                tokenStyle && (lineHeight = Math.max(lineHeight, token.lineHeight));
            }

            line.width = lineWidth;
            line.lineHeight = lineHeight;
            contentHeight += lineHeight;
            contentWidth = Math.max(contentWidth, lineWidth);
        }

        contentBlock.outerWidth = contentBlock.width = retrieve2(style.textWidth, contentWidth);
        contentBlock.outerHeight = contentBlock.height = retrieve2(style.textHeight, contentHeight);

        var textPadding = style.textPadding;
        if (textPadding) {
            contentBlock.outerWidth += textPadding[1] + textPadding[3];
            contentBlock.outerHeight += textPadding[0] + textPadding[2];
        }

        return contentBlock;
    }

    function pushTokens(block, str, styleName) {
        var isEmptyStr = str === '';
        var strs = str.split('\n');
        var lines = block.lines;

        for (var i = 0; i < strs.length; i++) {
            var text = strs[i];
            var token = {
                styleName: styleName,
                text: text,
                isLineHolder: !text && !isEmptyStr
            };

            // The first token should be appended to the last line.
            if (!i) {
                var tokens = (lines[lines.length - 1] || (lines[0] = {tokens: []})).tokens;

                // Consider cases:
                // (1) ''.split('\n') => ['', '\n', ''], the '' at the first item
                // (which is a placeholder) should be replaced by new token.
                // (2) A image backage, where token likes {a|}.
                // (3) A redundant '' will affect textAlign in line.
                // (4) tokens with the same tplName should not be merged, because
                // they should be displayed in different box (with border and padding).
                var tokensLen = tokens.length;
                (tokensLen === 1 && tokens[0].isLineHolder)
                    ? (tokens[0] = token)
                    // Consider text is '', only insert when it is the "lineHolder" or
                    // "emptyStr". Otherwise a redundant '' will affect textAlign in line.
                    : ((text || !tokensLen || isEmptyStr) && tokens.push(token));
            }
            // Other tokens always start a new line.
            else {
                // If there is '', insert it as a placeholder.
                lines.push({tokens: [token]});
            }
        }
    }

    var textContain = {

        getWidth: getTextWidth,

        getBoundingRect: getTextRect,

        adjustTextPositionOnRect: adjustTextPositionOnRect,

        truncateText: truncateText,

        measureText: measureText,

        getLineHeight: getLineHeight,

        parsePlainText: parsePlainText,

        parseRichText: parseRichText,

        adjustTextX: adjustTextX,

        adjustTextY: adjustTextY,

        DEFAULT_FONT: DEFAULT_FONT
    };

    return textContain;
});