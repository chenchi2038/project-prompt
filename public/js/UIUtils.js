class UIUtils {
    static showMessage(message, type = 'success') {
        const messageArea = document.getElementById('messageArea');
        const messageContent = document.getElementById('messageContent');

        messageContent.textContent = message;
        messageContent.className = `alert alert-${type === 'error' ? 'danger' : 'success'}`;

        messageArea.style.display = 'block';

        setTimeout(() => {
            messageArea.style.display = 'none';
        }, 3000);
    }

    static showLoadingIndicator(show) {
        const indicator = document.getElementById('loadingIndicator');
        indicator.style.display = show ? 'block' : 'none';
    }

    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static highlightText(text, filter) {
        if (!filter) return text;

        if (text.includes('/')) {
            return UIUtils.highlightFilePath(text, filter);
        } else {
            const regex = new RegExp(`(${filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            return text.replace(regex, '<mark>$1</mark>');
        }
    }

    static highlightFilePath(filePath, filter) {
        if (!filter) return filePath;

        const filterLower = filter.toLowerCase();

        if (filterLower.includes('/')) {
            return UIUtils.highlightByPathSegments(filePath, filterLower);
        } else {
            return UIUtils.highlightBySingleSegment(filePath, filterLower);
        }
    }

    static highlightByPathSegments(filePath, filter) {
        const filterSegments = filter.split('/').filter(seg => seg.length > 0);
        let result = filePath;

        for (const filterSegment of filterSegments) {
            result = UIUtils.highlightSegmentInPath(result, filterSegment);
        }

        return result;
    }

    static highlightBySingleSegment(filePath, filter) {
        const pathSegments = filePath.split('/');
        const highlightedSegments = pathSegments.map(segment => {
            return UIUtils.highlightInSegment(segment, filter);
        });

        return highlightedSegments.join('/');
    }

    static highlightSegmentInPath(filePath, filterSegment) {
        const pathSegments = filePath.split('/');
        let bestMatchIndex = -1;
        let bestMatchType = '';

        for (let i = 0; i < pathSegments.length; i++) {
            const segment = pathSegments[i].toLowerCase();
            const filter = filterSegment.toLowerCase();

            if (segment === filter) {
                bestMatchIndex = i;
                bestMatchType = 'exact';
                break;
            } else if (segment.startsWith(filter)) {
                if (bestMatchType !== 'exact') {
                    bestMatchIndex = i;
                    bestMatchType = 'start';
                }
            } else if (segment.includes(filter)) {
                if (bestMatchType !== 'exact' && bestMatchType !== 'start') {
                    bestMatchIndex = i;
                    bestMatchType = 'contains';
                }
            } else if (UIUtils.fuzzyMatch(segment, filter)) {
                if (bestMatchType === '') {
                    bestMatchIndex = i;
                    bestMatchType = 'fuzzy';
                }
            }
        }

        if (bestMatchIndex >= 0) {
            pathSegments[bestMatchIndex] = UIUtils.highlightInSegment(pathSegments[bestMatchIndex], filterSegment);
        }

        return pathSegments.join('/');
    }

    static highlightInSegment(segment, filter) {
        const segmentLower = segment.toLowerCase();
        const filterLower = filter.toLowerCase();

        if (segmentLower.includes(filterLower)) {
            const regex = new RegExp(`(${filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            return segment.replace(regex, '<mark>$1</mark>');
        } else if (UIUtils.fuzzyMatch(segmentLower, filterLower)) {
            return UIUtils.highlightFuzzyMatch(segment, filter);
        }

        return segment;
    }

    static fuzzyMatch(text, pattern) {
        let patternIndex = 0;
        for (let i = 0; i < text.length && patternIndex < pattern.length; i++) {
            if (text[i] === pattern[patternIndex]) {
                patternIndex++;
            }
        }
        return patternIndex === pattern.length;
    }

    static highlightFuzzyMatch(text, pattern) {
        const textLower = text.toLowerCase();
        const patternLower = pattern.toLowerCase();
        let result = '';
        let patternIndex = 0;
        let inMark = false;

        for (let i = 0; i < text.length; i++) {
            const isMatch = patternIndex < patternLower.length && textLower[i] === patternLower[patternIndex];

            if (isMatch && !inMark) {
                result += '<mark>' + text[i];
                inMark = true;
                patternIndex++;
            } else if (isMatch && inMark) {
                result += text[i];
                patternIndex++;
            } else if (!isMatch && inMark) {
                result += '</mark>' + text[i];
                inMark = false;
            } else {
                result += text[i];
            }
        }

        if (inMark) {
            result += '</mark>';
        }

        return result;
    }

    static positionDropdownAtCursor(dropdown, textarea, atPosition) {
        const textareaRect = textarea.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(textarea);

        const fontSize = parseInt(computedStyle.fontSize);
        const lineHeight = parseInt(computedStyle.lineHeight) || fontSize * 1.5;

        const textBeforeCursor = textarea.value.substring(0, atPosition);
        const lines = textBeforeCursor.split('\n');
        const currentLine = lines.length - 1;
        const currentColumn = lines[lines.length - 1].length;

        const charWidth = fontSize * 0.6;

        const paddingLeft = parseInt(computedStyle.paddingLeft) || 0;
        const paddingTop = parseInt(computedStyle.paddingTop) || 0;

        const cursorX = textareaRect.left + paddingLeft + (currentColumn * charWidth);
        const cursorY = textareaRect.top + paddingTop + (currentLine * lineHeight);

        dropdown.style.display = 'block';
        dropdown.style.position = 'fixed';
        dropdown.style.left = cursorX + 'px';
        dropdown.style.top = (cursorY + lineHeight + 5) + 'px';
        dropdown.style.zIndex = '1000';

        setTimeout(() => {
            const dropdownRect = dropdown.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;

            if (dropdownRect.right > viewportWidth) {
                dropdown.style.left = Math.max(10, viewportWidth - dropdownRect.width - 10) + 'px';
            }

            if (dropdownRect.bottom > viewportHeight) {
                dropdown.style.top = (cursorY - dropdownRect.height - 5) + 'px';
            }
        }, 0);
    }

    static async copyToClipboard(text, successMessage = '已复制到剪贴板') {
        try {
            await navigator.clipboard.writeText(text);
            UIUtils.showMessage(successMessage, 'success');
        } catch (err) {
            const tempTextarea = document.createElement('textarea');
            tempTextarea.value = text;
            document.body.appendChild(tempTextarea);
            tempTextarea.select();
            document.execCommand('copy');
            document.body.removeChild(tempTextarea);
            UIUtils.showMessage(successMessage, 'success');
        }
    }

    static generateTemplateContent(templateType) {
        switch (templateType) {
            case 'simple':
                return `# 目标\n\n# 参考\n\n# 注意事项\n\n`;
            case 'database':
                return `# 目标\n生成mysql数据库变更脚本，不要写入文件，给我语句即可\n\n`;
            default:
                console.warn('未知的模板类型:', templateType);
                return '';
        }
    }

    static clearForm(formId) {
        const form = document.getElementById(formId);
        if (form) {
            form.reset();
        }
    }

    static hideModal(modalId) {
        const modal = bootstrap.Modal.getInstance(document.getElementById(modalId));
        if (modal) {
            modal.hide();
        }
    }

    static showModal(modalId) {
        const modal = new bootstrap.Modal(document.getElementById(modalId));
        modal.show();
        return modal;
    }
}