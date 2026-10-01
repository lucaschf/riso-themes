package lucascristovam.riso.python

import com.intellij.codeInsight.daemon.impl.HighlightVisitor
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.jetbrains.python.codeInsight.controlflow.ControlFlowCache
import com.jetbrains.python.codeInsight.controlflow.ScopeOwner
import com.jetbrains.python.codeInsight.dataflow.scope.ScopeUtil
import com.jetbrains.python.psi.PyCallExpression
import com.jetbrains.python.psi.PyClass
import com.jetbrains.python.psi.PyFile
import com.jetbrains.python.psi.PyFunction
import com.jetbrains.python.psi.PyKeywordArgument
import com.jetbrains.python.psi.PyLambdaExpression
import com.jetbrains.python.psi.PyNamedParameter
import com.jetbrains.python.psi.PyReferenceExpression
import com.jetbrains.python.psi.PyTargetExpression
import com.jetbrains.python.psi.impl.PyBuiltinCache
import lucascristovam.riso.RisoPalette
import lucascristovam.riso.RisoSettings
import lucascristovam.riso.RisoVisitor

/**
 * Color by name for Python, with the rules of the VS Code extension:
 * parameters and keyword arguments, local variables (closures and
 * comprehensions included), attributes and class fields, UPPER_CASE
 * constants, and classes — library ones too, built-ins not. Globals and
 * imports keep the theme's color. Locals are found from the function scopes'
 * declarations, without resolving references; only capitalized names are
 * resolved, to tell a class from anything else.
 */
class PythonNameColors : RisoVisitor() {
    override fun suitableForFile(file: PsiFile): Boolean = file is PyFile && RisoSettings.options.colorByName

    override fun clone(): HighlightVisitor = PythonNameColors()

    override fun visit(element: PsiElement) {
        val o = RisoSettings.options
        when (element) {
            is PyNamedParameter ->
                if (o.parameters && !element.isSelf && element.name !in SELF_NAMES) element.nameIdentifier?.let(::color)
            is PyKeywordArgument -> if (o.parameters) element.keywordNode?.psi?.let(::color)
            is PyClass -> if (o.types) element.nameIdentifier?.let(::color)
            is PyTargetExpression -> target(element, o)
            is PyReferenceExpression -> reference(element, o)
        }
    }

    private fun target(target: PyTargetExpression, o: RisoSettings.Options) {
        val id = target.nameIdentifier ?: return
        val name = target.name ?: return
        val paint = when {
            target.isQualified -> o.attributes // self.x = …
            isConstant(name) -> o.constants
            ScopeUtil.getScopeOwner(target) is PyClass -> o.attributes // class field
            isLocal(target, name) -> o.locals
            else -> false // a plain global
        }
        if (paint) color(id)
    }

    private fun reference(ref: PyReferenceExpression, o: RisoSettings.Options) {
        val nameElement = ref.nameElement?.psi ?: return
        val name = ref.referencedName ?: return
        if (ref.isQualified) {
            val paint = when {
                isCallee(ref) -> false // obj.method(): methods keep the function color
                isConstant(name) -> o.constants // Status.OK
                else -> o.attributes // obj.x
            }
            if (paint) color(nameElement)
            return
        }
        if (name in SELF_NAMES) return
        val paint = when {
            isLocal(ref, name) -> if (isParameter(ref, name)) o.parameters else o.locals
            isConstant(name) -> o.constants && !isBuiltin(ref)
            name.first().isUpperCase() -> o.types && isLibraryOrOwnClass(ref)
            else -> false
        }
        if (paint) color(nameElement)
    }

    /** Declared in an enclosing function, lambda or comprehension (class bodies don't count, as in Python). */
    private fun isLocal(element: PsiElement, name: String): Boolean =
        enclosingScopes(element).any { ControlFlowCache.getScope(it).containsDeclaration(name) }

    private fun isParameter(element: PsiElement, name: String): Boolean =
        enclosingScopes(element).any {
            when (it) {
                is PyFunction -> it.parameterList.findParameterByName(name) != null
                is PyLambdaExpression -> it.parameterList.findParameterByName(name) != null
                else -> false
            }
        }

    private fun enclosingScopes(element: PsiElement): Sequence<ScopeOwner> =
        generateSequence(ScopeUtil.getScopeOwner(element)) { ScopeUtil.getScopeOwner(it) }
            .takeWhile { it !is PyFile }
            .filter { it !is PyClass }

    private fun isCallee(ref: PyReferenceExpression): Boolean = (ref.parent as? PyCallExpression)?.callee == ref

    private fun isLibraryOrOwnClass(ref: PyReferenceExpression): Boolean {
        val resolved = ref.reference.resolve()
        return resolved is PyClass && !PyBuiltinCache.getInstance(ref).isBuiltin(resolved)
    }

    private fun isBuiltin(ref: PyReferenceExpression): Boolean {
        val resolved = ref.reference.resolve() ?: return false
        return PyBuiltinCache.getInstance(ref).isBuiltin(resolved)
    }

    private fun color(element: PsiElement) {
        val name = element.text
        if (name.isNotEmpty()) paint(element.textRange, RisoPalette.colorFor(name, inks.identifiers))
    }

    private companion object {
        val SELF_NAMES = setOf("self", "cls")
        val CONSTANT = Regex("^_*[A-Z][A-Z0-9_]+$")

        fun isConstant(name: String) = CONSTANT.matches(name)
    }
}
