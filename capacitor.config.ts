import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.workoutapp.app',
  appName: 'Workout',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
}

export default config
