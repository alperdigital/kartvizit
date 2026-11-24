import js from '@eslint/js'
import ts from 'typescript-eslint'
export default [{ ignores: ['dist/**','public/**','scripts/**'] },js.configs.recommended,...ts.configs.recommended]
