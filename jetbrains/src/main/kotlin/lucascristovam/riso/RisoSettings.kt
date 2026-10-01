package lucascristovam.riso

import com.intellij.codeInsight.daemon.DaemonCodeAnalyzer
import com.intellij.openapi.components.BaseState
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.SimplePersistentStateComponent
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.components.service
import com.intellij.openapi.options.BoundConfigurable
import com.intellij.openapi.project.ProjectManager
import com.intellij.openapi.ui.DialogPanel
import com.intellij.ui.dsl.builder.bindSelected
import com.intellij.ui.dsl.builder.panel

@Service(Service.Level.APP)
@State(name = "RisoSettings", storages = [Storage("riso.xml")])
class RisoSettings : SimplePersistentStateComponent<RisoSettings.Options>(Options()) {
    class Options : BaseState() {
        var rainbowBrackets by property(true)
        var colorByName by property(true)
        var parameters by property(true)
        var locals by property(true)
        var attributes by property(true)
        var constants by property(true)
        var types by property(true)
    }

    companion object {
        val options: Options get() = service<RisoSettings>().state
    }
}

/** Settings → Appearance → Riso. */
class RisoConfigurable : BoundConfigurable("Riso") {
    override fun createPanel(): DialogPanel {
        val o = RisoSettings.options
        return panel {
            group("Brackets") {
                row { checkBox("Color brackets by nesting level").bindSelected(o::rainbowBrackets) }
                row { comment("Any language. Six levels, in the inks of the current Riso theme.") }
            }
            group("Color by Name") {
                row { checkBox("Give every name its own color").bindSelected(o::colorByName) }
                indent {
                    row { checkBox("Parameters and keyword arguments").bindSelected(o::parameters) }
                    row { checkBox("Local variables").bindSelected(o::locals) }
                    row { checkBox("Attributes (self.x, obj.x, class fields)").bindSelected(o::attributes) }
                    row { checkBox("Constants (UPPER_CASE)").bindSelected(o::constants) }
                    row { checkBox("Classes").bindSelected(o::types) }
                }
                row {
                    comment(
                        "Python. Globals, imports and built-ins keep the theme's color. A name gets the same " +
                            "color as in the Riso VS Code extension.",
                    )
                }
            }
        }
    }

    override fun apply() {
        super.apply()
        // Repaint open editors with the new choices.
        for (project in ProjectManager.getInstance().openProjects) {
            DaemonCodeAnalyzer.getInstance(project).restart()
        }
    }
}
