describe('export', function () {
	'use strict';

	it('should publish a global `axe` variable', function () {
		assert.isDefined(window.global.axe);
	});
	it('should define version', function () {
		assert.equal(axe.version, 'dev');
	});
});
