package lucascristovam.riso

import com.intellij.codeInsight.daemon.impl.HighlightInfo
import com.intellij.codeInsight.daemon.impl.HighlightInfoType
import com.intellij.codeInsight.daemon.impl.HighlightVisitor
import com.intellij.codeInsight.daemon.impl.analysis.HighlightInfoHolder
import com.intellij.lang.annotation.HighlightSeverity
import com.intellij.openapi.editor.DefaultLanguageHighlighterColors
import com.intellij.openapi.editor.markup.TextAttributes
import com.intellij.openapi.util.TextRange
import com.intellij.psi.PsiFile
import java.awt.Color

// TEXT_ATTRIBUTES draws above the syntax layer, where PyCharm and other plugins
// (VSCode Theme's annotator, for one) color the same names: on a shared layer
// the IDE picks either foreground. Warnings, errors and selection still win.
private val RISO_COLOR =
    HighlightInfoType.HighlightInfoTypeImpl(HighlightSeverity.TEXT_ATTRIBUTES, DefaultLanguageHighlighterColors.CONSTANT)

/**
 * A highlighting pass that only recolors text: the IDE calls [visit] for every
 * element of the file, and [paint] adds a foreground color on top of the
 * scheme's (keeping its italics, so parameters stay italic).
 */
abstract class RisoVisitor : HighlightVisitor {
    private var holder: HighlightInfoHolder? = null
    protected lateinit var inks: RisoPalette.Inks

    override fun analyze(file: PsiFile, updateWholeFile: Boolean, holder: HighlightInfoHolder, action: Runnable): Boolean {
        this.holder = holder
        inks = RisoPalette.current()
        try {
            action.run()
        } finally {
            this.holder = null
        }
        return true
    }

    protected fun paint(range: TextRange, color: Color) {
        val attributes = TextAttributes().apply { foregroundColor = color }
        HighlightInfo.newHighlightInfo(RISO_COLOR).range(range).textAttributes(attributes).create()
            ?.let { holder?.add(it) }
    }
}
