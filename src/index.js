const debug = require('debug')('metalsmith:migrate-safetag')
const minimatch = require('minimatch')
const _ = require('lodash')
const trimNewlines = require('trim-newlines')
const fs = require('fs')
const path = require('path')

/**
 * Expose `plugin`.
 */

module.exports = plugin

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
  const {
    activities = false,
    methods = false,
    references = false,
    images = false,
    document_matter = false,
    guides = false,
    reporting = false,
    origin,
    origin_path_prefix,
  } = options || {}

  return function(files, metalsmith, done) {
    //
    const footnotes = ':[](../references/footnotes.md)'

    // First pass reducer to group exercises files in one activity and prepare for transform pass.
    const walk = (acc, file, key) => {
      // Process activities.
      if (activities && minimatch(key, 'exercises/*/**.md')) {
        // Default to empty contents.
        const contents = { contents: new Buffer('') }

        const metadata = minimatch(key, 'exercises/*/index.md')
          ? {
              metadata: {
                ...(file.Authors ? { authors: file.Authors } : null),
                ...(file.Approach
                  ? { approach_category: file.Approach }
                  : null),
                ...(file.Org_size_under
                  ? { org_size_under: file.Org_size_under }
                  : null),
                ...(file.Remote_options
                  ? { remote_options: file.Remote_options }
                  : null),
                ...(file.Skills_required
                  ? { skills_required: file.Skills_required }
                  : null),
                ...(file.Time_required_minutes
                  ? { time_required_minutes: file.Time_required_minutes }
                  : null),
              },
            }
          : null

        // Get index content
        const index = minimatch(key, 'exercises/*/index.md')
          ? file.contents.toString()
          : null

        // Sanity check: Verify that activity index structure is as expected
        const fields = [
          'summary',
          'approach',
          'materials_needed',
          'operational_security',
          'instructions',
          'recommendations',
          'output',
        ]

        const includes_regexp = /^!INCLUDE\s"(.*)\.md"/gm

        let match
        const matches = []

        while ((match = includes_regexp.exec(index))) matches.push(match[1])

        matches.forEach(match => {
          if (!fields.includes(match))
            console.warn(
              'Unexpected transclusion ' +
                match +
                ' in activity index file ' +
                key
            )
        })

        // Match title

        const title =
          index && index.match(/^####\s(.*)$/m)
            ? { title: index.match(/^####\s(.*)$/m)[1] }
            : null

        const processTransclusions = str =>
          trimNewlines(str.toString().replace(includes_regexp, ':[]($1.md)'))

        // Sanity check: Check if transclusion destinations exist.

        const transclusionRE = /:\[\]\((.*)\)/gm
        let destLinks

        while (
          (destLinks = transclusionRE.exec(
            processTransclusions(file.contents)
          )) !== null
        ) {
          try {
            fs.openSync(
              path.join(
                metalsmith.source(),
                'exercises',
                key.split('exercises/')[1].split('/')[0],
                destLinks[1]
              ),
              fs.constants.O_RDONLY
            )
          } catch (e) {
            console.log(
              `Missing transclusion destination in ${key}:`,
              path.join(
                metalsmith.source(),
                'exercises',
                key.split('exercises/')[1].split('/')[0],
                destLinks[1]
              )
            )
          }
        }

        // Add included files as metadata on activity object.

        const summary = minimatch(key, 'exercises/*/summary.md')
          ? { summary: processTransclusions(file.contents) }
          : null

        const approach = minimatch(key, 'exercises/*/approach.md')
          ? { approach: processTransclusions(file.contents) }
          : null
        const materials = minimatch(key, 'exercises/*/materials_needed.md')
          ? { materials: processTransclusions(file.contents) }
          : null
        const opsec = minimatch(key, 'exercises/*/operational_security.md')
          ? { opsec: processTransclusions(file.contents) }
          : null
        const instructions = minimatch(key, 'exercises/*/instructions.md')
          ? { instructions: processTransclusions(file.contents) }
          : null
        const recommendations = minimatch(key, 'exercises/*/recommendations.md')
          ? { recommendations: processTransclusions(file.contents) }
          : null
        const output = minimatch(key, 'exercises/*/output.md')
          ? { output: processTransclusions(file.contents) }
          : null

        const id = {
          id: key
            .split('exercises/')[1]
            .split('/')[0]
            .replace(/_/g, '-'),
        }
        const activity = 'activities/' + id.id + '.md'
        // console.log('walk.activities.id', activity)
        // console.log('walk.activities.metadata', metadata)
        // Assemble single activity file with metadata fields for second pass.
        return {
          ...acc,
          [activity]: {
            ...acc[activity],
            ...id,
            ...contents,
            ...title,
            ...summary,
            ...approach,
            ...materials,
            ...opsec,
            ...instructions,
            ...output,
            ...recommendations,
            ...metadata,
            origin_path: origin_path_prefix + key,
          },
        }
      } else if (
        methods &&
        (minimatch(key, 'methods/*.md') || minimatch(key, 'methods/*/*.md'))
      ) {
        // Replace transclusion links and remove Activities heading
        const contents = file.contents
          .toString()
          .replace(/^!INCLUDE "(.*)"\W?$/gm, ':[]($1)')
          .replace(/\/exercises\//g, '/activities/')

        // Activities are listed in index.guide.md
        // For now, instead of scraping it, reuse taxonomy in toolkit pipeline to display activity browser.

        // Sanity check: Check if transclusion destinations exist.

        const transclusionRE = /:\[\]\((.*)\)/gm
        let destLinks

        while ((destLinks = transclusionRE.exec(contents)) !== null) {
          // We skip activities as they are linked to methods via the taxonomy
          if (!destLinks[1].includes('/activities/')) {
            try {
              fs.openSync(
                path.join(metalsmith.source(), 'methods', destLinks[1]),
                fs.constants.O_RDONLY
              )
            } catch (e) {
              console.log(
                `Missing transclusion destination in ${key}:`,
                path.join(metalsmith.source(), 'methods', destLinks[1])
              )
            }
          }
        }

        // Match title

        const title =
          contents && contents.match(/^##\s(.*)$/m)
            ? { title: contents.match(/^##\s(.*)$/m)[1] }
            : null

        // Assemble single activity file with metadata fields for second pass.
        // Create ${method}.md file as target for toolkit display and leave ${method}.guide.md for guide preview.
        return {
          ...acc,
          [key.replace('.guide.md', '.md')]: {
            ...file,
            contents: new Buffer(contents.replace(/^### Activities.?$/gm, '')),
            id: key.replace('.guide.md', '.md'),
            ...title,
            layout: 'method.md',
            origin_path: origin_path_prefix + key,
          },
          [key]: {
            ...file,
            contents: new Buffer(contents),
            id: key,
            ...title,
            layout: 'method.md',
            origin_path: origin_path_prefix + key,
          },
        }
      } else if (document_matter && minimatch(key, 'document_matter/**/*.md')) {
        // Replace transclusion links
        const contents = file.contents
          .toString()
          .replace(/^!INCLUDE "(.*)"\W?$/gm, ':[]($1)')

        // TODO:Sanity checks

        // Match title

        const title =
          contents && contents.match(/^##\s(.*)$/m)
            ? { title: contents.match(/^##\s(.*)$/m)[1] }
            : null

        // Assemble single activity file with metadata fields for second pass.
        return {
          ...acc,
          [key]: {
            ...file,
            contents: new Buffer(contents),
            id: key,
            ...title,
            layout: 'page.md',
            origin_path: origin_path_prefix + key,
          },
        }
      } else if (
        references &&
        minimatch(key, 'references/*.md') &&
        !minimatch(key, 'references/footnotes.md')
      ) {
        // TODO: Check external links and download for offline use.
        const contents = file.contents.toString()

        // TODO:Sanity checks

        // Match title

        const title =
          contents && contents.match(/^####\s(.*)$/m)
            ? { title: contents.match(/^####\s(.*)$/m)[1] }
            : null

        // Assemble single activity file with metadata fields for second pass.
        return {
          ...acc,
          [key]: {
            ...file,
            contents: new Buffer(contents),
            id: key,
            ...title,
            description: '',
            layout: 'reference.md',
            origin_path: origin_path_prefix + key,
          },
        }
      } else if (references && minimatch(key, 'references/footnotes.md')) {
        // Footnotes need to be transformed to prevent confusion with transclusion syntax

        const contents = file.contents.toString().replace(/(\[.*\]:)/g, '$1 ')

        // TODO:Sanity checks

        const title = 'footnotes'

        return {
          ...acc,
          [key]: {
            ...file,
            contents: new Buffer(contents),
            id: key,
            ...title,
            description: '',
            layout: 'reference.md',
            origin_path: origin_path_prefix + key,
          },
        }
      } else if (images && minimatch(key, 'images/**/*.*')) {
        // Move images to methods folder for now.
        // const move = 'methods/' + key;

        // TODO:Sanity checks

        // Assemble single activity file with metadata fields for second pass.
        return {
          ...acc,
          [key]: {
            ...file,
          },
        }
      } else if (guides && minimatch(key, 'index.guide.md')) {
        // Move guide to index.guide.md.
        const move = 'index.guide.md'

        const contents = file.contents
          .toString()
          .replace('\n!INCLUDE "methods/intro.md"', '')
          .replace(/^!INCLUDE "(.*)"\W?$/gm, ':[](./$1)')
          .replace(
            /:\[\]\(\.\/exercises\/(.*)\/index\.md\)/g,
            (_, slug) => ':[](./activities/' + slug.replace(/_/g, '-') + '.md)'
          )
          // Add footnotes
          .concat('\n:[](references/footnotes.md)')

        // Parse methods activities which are included in the index.guide
        // and reference them in order to add them to the method file.

        // TODO:Sanity checks

        return {
          ...acc,
          [move]: {
            ...file,
            contents: new Buffer(contents),
            layout: 'guide.md',
            origin_path: origin_path_prefix + key,
          },
        }
      }
      return acc
    }

    // Second pass transform.
    const transform = (file, key) => {
      // Add footnotes file to activities and methods (only the used ones will be displayed by pandoc)
      if (activities && minimatch(key, 'activities/**/*.md')) {
        const description = file.summary
          ? trimNewlines(file.summary)
              .substring(0, 120)
              .replace(/^##(.*)$/m, '')
              .replace(/\r?\n|\r/g, '')
              .replace(/!\[.*\]\((\S*)\s?(\S?)\)/g, '')
              .replace(/"/g, '')
              .split(' ')
              .slice(0, -1)
              .join(' ') + '...'
          : file.title || ''
        debug('description', description)

        return {
          ...file,
          ...file.metadata,
          contents: new Buffer(
            file.contents.toString().replace(/\\newpage/gm, '\n---')
          ),
          description,
          origin,
          footnotes,
        }
      } else if (methods && minimatch(key, 'methods/*.md')) {
        const summary =
          files[`${key.replace('.md', '')}/summary.md`] &&
          files[`${key.replace('.md', '')}/summary.md`].contents.toString()

        const description = summary
          ? trimNewlines(summary)
              .substring(0, 240)
              .replace(/^###(.*)$/m, '')
              .replace(/\r?\n|\r/g, '')
              .replace(/!\[.*\]\((\S*)\s?(\S?)\)/g, '')
              .replace(/"/g, '')
              .split(' ')
              .slice(0, -1)
              .join(' ') + '...'
          : file.title || ''
        debug('description', description)

        return {
          ...file,
          contents: new Buffer(
            file.contents.toString().replace(/\\newpage/gm, '\n---') +
              '\n' +
              files.activities
          ),
          description,
          origin,
          footnotes,
        }
      }

      const description = file.contents.toString()
        ? trimNewlines(file.contents.toString())
            .substring(0, 240)
            .replace(/^###(.*)$/m, '')
            .replace(/^##(.*)$/m, '')
            .replace(/\r?\n|\r/g, '')
            .replace(/!\[.*\]\((\S*)\s?(\S?)\)/g, '')
            .replace(/"/g, '')
            .replace(/\*/g, '')
            .split(' ')
            .slice(0, -1)
            .join(' ') + '...'
        : file.title || ''
      debug('description', description)

      return {
        ...file,
        contents: new Buffer(
          file.contents.toString().replace(/\\newpage/gm, '\n---')
        ),
        description,
        origin,
      }
    }

    const reduced = _.reduce(files, walk, {})
    const results = _.mapValues(reduced, transform)

    debug('results', results)

    // Delete original files object.
    Object.keys(files).forEach(key => {
      delete files[key]
    })

    // Restore files object with migration results
    // And add origin metatag for upstream edit link
    Object.keys(results).forEach(key => {
      files[key] = { ...results[key] }
    })

    done()
  }
}
