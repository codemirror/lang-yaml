import {parser} from "@lezer/yaml"
import {LRLanguage, delimitedIndent, indentNodeProp,
        foldNodeProp, foldInside, Language, LanguageSupport} from "@codemirror/language"
import {SyntaxNode, parseMixed} from "@lezer/common"
import {tags, styleTags} from "@lezer/highlight"
import {parser as frontmatterParser} from "./frontmatter.grammar"

/// A language provider based on the [Lezer YAML
/// parser](https://github.com/lezer-parser/yaml), extended with
/// highlighting and indentation information.
export const yamlLanguage = LRLanguage.define({
  name: "yaml",
  parser: parser.configure({
    props: [
      indentNodeProp.add({
        Stream: cx => {
          for (let before = cx.node.resolve(cx.pos, -1) as SyntaxNode | null;
               before && before.to >= cx.pos; before = before.parent) {
            if (before.name == "BlockLiteralContent" && before.from < before.to)
              return cx.baseIndentFor(before)
            if (before.name == "BlockLiteral")
              return cx.baseIndentFor(before) + cx.unit
            if (before.name == "BlockSequence" || before.name == "BlockMapping")
              return cx.column(before.from, 1)
            if (before.name == "QuotedLiteral")
              return null
            if (before.name == "Literal") {
              let col = cx.column(before.from, 1)
              if (col == cx.lineIndent(before.from, 1)) return col // Start on own line
              if (before.to > cx.pos) return null
            }
          }
          return null
        },
        FlowMapping: delimitedIndent({closing: "}"}),
        FlowSequence: delimitedIndent({closing: "]"}),
      }),
      foldNodeProp.add({
        "FlowMapping FlowSequence": foldInside,
        "Item Pair BlockLiteral":
          (node, state) => ({from: state.doc.lineAt(node.from).to, to: node.to})
      })
    ]
  }),
  languageData: {
    commentTokens: {line: "#"},
    indentOnInput: /^\s*[\]\}]$/,
  }
})

/// Language support for YAML.
export function yaml() {
  return new LanguageSupport(yamlLanguage)
}

const frontmatterLanguage = LRLanguage.define({
  name: "yaml-frontmatter",
  parser: frontmatterParser.configure({
    props: [styleTags({DashLine: tags.meta})]
  })
})

/// Returns language support for a document parsed as `config.content`
/// with an optional YAML "frontmatter" delimited by lines that
/// contain three dashes.
export function yamlFrontmatter(config: {content: Language | LanguageSupport}) {
  let {language, support} = config.content instanceof LanguageSupport ? config.content
    : {language: config.content, support: []}
  return new LanguageSupport(frontmatterLanguage.configure({
    wrap: parseMixed(node => {
      return node.name == "FrontmatterContent" ? {parser: yamlLanguage.parser}
        : node.name == "Body" ? {parser: language.parser}
        : null
    })
  }), support)
}
