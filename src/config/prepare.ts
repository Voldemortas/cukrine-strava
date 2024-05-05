import {ROOT_PATH} from '../commons/paths'
import {ENV_ENUM} from '../commons/enums'

const CONFIG_FILE_PATH = ROOT_PATH + '/.env'

const configFile = Bun.file(CONFIG_FILE_PATH)

try {
  const fileExists = await configFile.exists()
  if (!fileExists) {
    const configContent = Object.entries(ENV_ENUM).map(
      ([key, value]) => `${key}=${value}\n`
    )
    await Bun.write(configFile, configContent)
  }
} catch (e) {
  console.error('Failed to do stuff with .env file:', e)
}

