/*global dom, color */
/* jshint maxstatements: 29, maxcomplexity: 13 */

/**
 * Returns the non-alpha-blended background color of a node, null if it's an image
 * @param {Element} node
 * @return {Color}
 */
var getBackgroundForSingleNode = function(node) {
	var bgColor,
		dv = node.ownerDocument.defaultView,
		nodeStyle = dv.getComputedStyle(node);

	if (nodeStyle.getPropertyValue('background-image') !== 'none') {
		return null;
	}

	var bgColorString = nodeStyle.getPropertyValue('background-color');
	//Firefox exposes unspecified background as 'transparent' rather than rgba(0,0,0,0)
	if (bgColorString === 'transparent') {
		bgColor = new color.Color(0, 0, 0, 0);
	} else {
		bgColor = new color.Color();
		bgColor.parseRgbString(bgColorString);
	}
	var opacity = nodeStyle.getPropertyValue('opacity');
	bgColor.alpha = bgColor.alpha * opacity;

	return bgColor;
};

/**
 * Determines whether an element has a fully opaque background, whether solid color or an image
 * @param {Element} node
 * @return {Boolean} false if the background is transparent, true otherwise
 */
dom.isOpaque = function(node) {
	var bgColor = getBackgroundForSingleNode(node);
	if (bgColor === null || bgColor.alpha === 1) {
		return true;
	}
	return false;
};

/**
 * Returns the elements that are visually "above" this one in z-index order where
 * supported at the position given inside the top-left corner of the provided
 * rectangle. Where not supported (IE < 10), returns the DOM parents.
 * @param {Element} node
 * @param {DOMRect} rect rectangle containing dimensions to consider
 * @return {Array} array of elements
 */
var getVisualParents = function(node, rect) {
	var visualParents,
		thisIndex,
		parents = [],
		fallbackToVisual = false,
		dv = node.ownerDocument.defaultView,
		currentNode = node,
		nodeStyle = dv.getComputedStyle(currentNode),
		posVal, topVal, bottomVal, leftVal, rightVal;

	while (currentNode !== null && (!dom.isOpaque(currentNode) || parseInt(nodeStyle.getPropertyValue('height'), 10) === 0)) {
		posVal = nodeStyle.getPropertyValue('position');
		topVal = nodeStyle.getPropertyValue('top');
		bottomVal = nodeStyle.getPropertyValue('bottom');
		leftVal = nodeStyle.getPropertyValue('left');
		rightVal = nodeStyle.getPropertyValue('right');
		if ((posVal !== 'static' && posVal !== 'relative') ||
			(posVal === 'relative' &&
				(leftVal !== 'auto' ||
					rightVal !== 'auto' ||
					topVal !== 'auto' ||
					bottomVal !== 'auto'))) {
			fallbackToVisual = true;
		}
		currentNode = currentNode.parentElement;
		if (currentNode !== null) {
			nodeStyle = dv.getComputedStyle(currentNode);
			if (parseInt(nodeStyle.getPropertyValue('height'), 10) !== 0) {
				parents.push(currentNode);
			}
		}
	}

	if (fallbackToVisual && dom.supportsElementsFromPoint(node.ownerDocument)) {
		visualParents = dom.elementsFromPoint(node.ownerDocument,
			Math.ceil(rect.left + 1),
			Math.ceil(rect.top + 1));
		if (visualParents && (thisIndex = visualParents.indexOf(node)) < visualParents.length - 1) {
			parents = visualParents.slice(thisIndex + 1);
		}
	}

	return parents;
};


/**
 * Returns the flattened background color of an element, or null if it can't be determined because
 * there is no opaque ancestor element visually containing it, or because background images are used.
 * @param {Element} node
 * @param {Array} bgNodes array to which all encountered nodes should be appended
 * @return {Color}
 */
color.getBackgroundColor = function(node, bgNodes) {
	var parent, parentColor;

	var bgColor = getBackgroundForSingleNode(node);
	if (bgNodes && (bgColor === null || bgColor.alpha !== 0)) {
		bgNodes.push(node);
	}
	if (bgColor === null || bgColor.alpha === 1) {
		return bgColor;
	}

	node.scrollIntoView();
	var rect = node.getBoundingClientRect(),
		currentNode = node,
		colorStack = [{
			color: bgColor,
			node: node
		}],
		parents = getVisualParents(currentNode, rect);

	while (bgColor.alpha !== 1) {
		parent = parents.shift();


		if (!parent && currentNode.tagName !== 'HTML') {
			return null;
		}

		//Assume white if top level is not specified
		if (!parent && currentNode.tagName === 'HTML') {
			parentColor = new color.Color(255, 255, 255, 1);
		} else {

			if (!dom.visuallyContains(node, parent)) {
				return null;
			}

			parentColor = getBackgroundForSingleNode(parent);
			if (bgNodes && (parentColor === null || parentColor.alpha !== 0)) {
				bgNodes.push(parent);
			}
			if (parentColor === null) {
				return null;
			}
		}
		currentNode = parent;
		bgColor = parentColor;
		colorStack.push({
			color: bgColor,
			node: currentNode
		});
	}

	var currColorNode = colorStack.pop();
	var flattenedColor = currColorNode.color;

	while ((currColorNode = colorStack.pop()) !== undefined) {
		flattenedColor = color.flattenColors(currColorNode.color, flattenedColor);
	}
	return flattenedColor;
};
