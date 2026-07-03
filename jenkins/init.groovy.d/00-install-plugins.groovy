import jenkins.model.*
import java.util.logging.Logger

def logger = Logger.getLogger("install-plugins")
def instance = Jenkins.getInstance()
def pm = instance.getPluginManager()
def uc = instance.getUpdateCenter()

// List of plugins we want
def plugins = [
    "workflow-aggregator",
    "git",
    "nodejs"
]

def installed = false

plugins.each { name ->
    if (!pm.getPlugin(name)) {
        logger.info("Requesting installation of plugin: \${name}")
        def plugin = uc.getPlugin(name)
        if (plugin) {
            // deploy() with true handles dependencies
            def deployment = plugin.deploy(true)
            deployment.get() // wait for it
            installed = true
            logger.info("Plugin \${name} installation requested with dependencies.")
        } else {
            logger.warning("Plugin \${name} not found in update center!")
        }
    }
}

if (installed) {
    logger.info("New plugins installed, saving and restarting...")
    instance.save()
    // We can't easily do a full restart from here that activations plugins
    // But we can signal that a restart is needed
}
println "Plugin installation check finished."
