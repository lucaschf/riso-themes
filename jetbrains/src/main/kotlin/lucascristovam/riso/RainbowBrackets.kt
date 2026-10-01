package lucascristovam.riso

import com.intellij.codeInsight.daemon.impl.HighlightVisitor
import com.intellij.lang.BracePair
import com.intellij.lang.Language
import com.intellij.lang.LanguageBraceMatching
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.tree.IElementType

/**
 * One color per nesting level, in any language: the brace pairs come from the
 * language's own brace matcher, and a bracket's level is the number of
 * bracketed constructs (elements with a direct left-brace child) around the
 * construct it belongs to.
 */
class RainbowBrackets : RisoVisitor() {
    override fun suitableForFile(file: PsiFile): Boolean = RisoSettings.options.rainbowBrackets

    override fun clone(): HighlightVisitor = RainbowBrackets()

    override fun visit(element: PsiElement) {
        if (element.firstChild != null) return // braces are leaves
        val type = element.node?.elementType ?: return
        val pairs = pairsOf(element.language)
        if (pairs.isEmpty() || pairs.none { it.leftBraceType == type || it.rightBraceType == type }) return
        val construct = element.parent ?: return
        val lefts = pairs.mapTo(HashSet()) { it.leftBraceType }
        val level = generateSequence(construct.parent) { it.parent }
            .takeWhile { it !is PsiFile }
            .count { isBracketed(it, lefts) }
        paint(element.textRange, inks.brackets[level % inks.brackets.size])
    }

    private fun isBracketed(element: PsiElement, lefts: Set<IElementType>): Boolean {
        var child = element.firstChild
        while (child != null) {
            if (child.firstChild == null && child.node?.elementType in lefts) return true
            child = child.nextSibling
        }
        return false
    }

    private fun pairsOf(language: Language): List<BracePair> =
        LanguageBraceMatching.INSTANCE.forLanguage(language)?.pairs?.toList() ?: emptyList()
}
