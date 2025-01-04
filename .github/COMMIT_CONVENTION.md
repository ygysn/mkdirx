# Commit Message Format
This specification is inspired by [AngularJS commit message](https://docs.google.com/document/d/1QrDFcIiPjSLDn3EL15IJygNPiHORgU1_OOAqWjiDU5Y/edit#)

A commit message consists of a header, body and footer. The header contains the type, scope and a brief summary.
```
<type>(<scope>): <short summary>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

## Revert
If the commit reverts a previous commit, its header should begin with `revert: `, followed by the header of the reverted commit. In the body it should say: `This reverts commit <hash>.`, where the hash is the SHA of the commit being reverted.

## Commit Message Header
The message header commit contains the type, scope and a short summary. Type and short summary are mandatory, while scope is not.

### Type
- feat: Added new features.
- fix: Bug fixes
- docs: Changes only in the documentation
- style: Changes in the code, without changing the behavior.
- refactor: Changes in code that do not aim to add new features or fix bugs.
- perf: Changes in code to improve performance
- test: Changes in tests.
- build: Changes that affect the build system.
- ci: Changes in CI.

### Scope
Scope can be any place of a commit change.

### Short Summary
A short summary is a very short explanation of the changes made. The short summary should consist of:
- Use imperative, present tense: "change" not "changed" nor "changes".
- Do'nt capitalize first letter.
- No dot (.) at the end.

## Commit Message Body
- Just as in `<subject>` use imperative, present tense: "change" not "changed" nor "changes”.
- Includes motivation for the change and contrasts with previous behavior.

## Commit Message Footer
Commit message footer will contain about breaking change or referencing issue. Footer is not mandatory.

### Breaking Change
All breaking changes have to be mentioned as a breaking change block in the footer, which should start with the word BREAKING CHANGE: with a space or two newlines. The rest of the commit message is then the description of the change, justification and migration notes.

### Referencing Issue
Closed bugs should be listed on a separate line in the footer prefixed with "Closes" keyword like this: \
`Closes #234`

Or in case of multiple issues: \
`Closes #123, #245, #992`
