﻿ (function(root) {
    // this allows us to cleanly vendor AMD-compatible scripts without polluting scope or registering 
    // private scripts in the root require namespace.
    // only downside is, you have to refer to the build script (Gruntfile) to see what order you brought them in.
	var amds = [],
	internalDefine = function() {
        var fac = [].pop.apply(arguments);
        amds.push(typeof fac == "function" ? fac() : fac);
	};
	internalDefine.amd = {};
    // only while this library is evaluating, let's replace window.define
    var externalDefine = root.define;
    var define = root.define = internalDefine;
	(function (exportFn) {
		exportFn(function () {