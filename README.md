# Jango AI - Mobile Client

This repository contains the React Native (Expo) mobile application for the Enterprise AI Swarm (Jango). It provides a real-time chat interface, secure authentication, and direct access to the Swarm backend hosted on Render.

## 🛠️ Prerequisites
Before you begin, ensure you have the following installed:

```
Node.js (v18 or higher)

Git

An Android Emulator, iOS Simulator, or the Expo Go app installed on your physical device.

An Expo/EAS Account (Required for building the final APK).
```

## 🚀 Step-by-Step Environment Setup

1. Initialize the Expo Project
Do not manually create an empty folder. Let Expo generate the required native configurations. Open your terminal and run:

```Bash
npx create-expo-app jango-mobile -t blank-typescript
cd jango-mobile
```

2. Install Required Dependencies
You need to install the Supabase client and any required polyfills for React Native. Run the following command:

```Bash
npx expo install @supabase/supabase-js react-native-url-polyfill
```

3. File Structure Setup
In the root directory of your new project, you will replace the default App.tsx with your application code.

Open the App.tsx/ index.tsx file in your project root.

Delete all existing code.

Paste the full monolithic frontend code provided into this App.tsx file.

Create a file named supabase.ts in the same directory to initialize your database connection:
```
TypeScript
// supabase.ts
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

