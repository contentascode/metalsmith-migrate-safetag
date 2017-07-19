'use strict';

var _sourceMapSupport2 = require('source-map-support');

(0, _sourceMapSupport2.install)();
var debug = require('debug')('metalsmith:migrate-safetag');
var hercule = require('hercule');
var async = require('async');
var path = require('path');
var minimatch = require('minimatch');
var _ = require('lodash');
var trimNewlines = require('trim-newlines');

/**
 * Expose `plugin`.
 */

module.exports = plugin;

/**
 * Metalsmith plugin to migrate SAFETAG content to the metalsmith approach.
 *
 *
 * @param {Object} options
 * @param {boolean} options.activities Migrate activities.
 *
 * @return {Function}
 */

function plugin(options) {
  var _ref = options || {},
      _ref$activities = _ref.activities,
      activities = _ref$activities === undefined ? false : _ref$activities;

  return function (files, metalsmith, done) {
    // First pass reducer to group exercises files in one activity and prepare for transform pass.
    var walk = function walk(acc, file, key) {
      // Process activities.
      if (activities && minimatch(key, '*/exercises/*/**.md')) {
        // Default to empty contents.
        var contents = { contents: new Buffer('') };

        // Get index content
        var index = minimatch(key, '*/exercises/*/index.md') ? file.contents.toString() : null;

        // Sanity checks
        var fields = ['summary', 'approach', 'materials_needed', 'operational_security', 'instructions', 'recommendations'];

        var includes_regexp = /^!INCLUDE\s\"(.*)\.md\"/gm;

        var match = void 0,
            matches = [];

        while (match = includes_regexp.exec(index)) {
          matches.push(match[1]);
        }matches.forEach(function (match) {
          if (!fields.includes(match)) console.warn('Unknown field ' + match + ' in file ' + key);
        });

        // Match title

        var title = index && index.match(/^####\s(.*)$/m) ? { title: index.match(/^####\s(.*)$/m)[1] } : null;

        // Add included files as metadata on activity object.

        var summary = minimatch(key, '*/exercises/*/summary.md') ? { summary: trimNewlines(file.contents.toString()) } : null;

        var approach = minimatch(key, '*/exercises/*/approach.md') ? { approach: trimNewlines(file.contents.toString()) } : null;
        var materials = minimatch(key, '*/exercises/*/materials_needed.md') ? { materials: trimNewlines(file.contents.toString()) } : null;
        var opsec = minimatch(key, '*/exercises/*/operational_security.md') ? { opsec: trimNewlines(file.contents.toString()) } : null;
        var instructions = minimatch(key, '*/exercises/*/instructions.md') ? { instructions: trimNewlines(file.contents.toString()) } : null;
        var recommendations = minimatch(key, '*/exercises/*/recommendations.md') ? { recommendations: trimNewlines(file.contents.toString()) } : null;

        var id = { id: key.split('exercises/')[1].split('/')[0].replace(/_/g, '-') };
        var activity = 'activities/' + id.id + '/index.md';

        // Assemble single activity file with metadata fields for second pass.
        return Object.assign({}, acc, {
          [activity]: Object.assign({}, acc[activity], id, contents, title, summary, approach, materials, opsec, instructions, recommendations)
        });
      }
      return acc;
    };

    // Second pass transform.
    var transform = function transform(file, key) {
      // Deal with special cases
      if (activities && key === 'activities/check-user-browser-vulns/index.md') {
        return Object.assign({}, file, {
          title: 'Check user browser vulnerabilities',
          description: 'Outdated Java browser plugins',
          contents: files['en/exercises/check_user_browser_vulns/browser_java_plugin.md'].contents
        });
      } else if (activities) {
        var description = file.summary ? trimNewlines(file.summary).substring(0, 120).replace(/^##(.*)$/m, '').replace(/\r?\n|\r/g, '').split(' ').slice(0, -1).join(' ') + '...' : file.title;
        debug('description', description);
        return Object.assign({}, file, { description });
      }
      return file;
    };

    var reduced = _.reduce(files, walk, {});
    var results = _.mapValues(reduced, transform);

    // Delete original files object.
    Object.keys(files).forEach(function (key) {
      delete files[key];
    });

    // Restore files object with migration results
    Object.keys(results).forEach(function (key) {
      files[key] = results[key];
    });

    done();
  };
}