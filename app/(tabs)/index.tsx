import { Session } from '@supabase/supabase-js';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert,
  FlatList,
  Image,
  KeyboardAvoidingView, Modal, Platform, SafeAreaView,
  StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { supabase } from './supabase';

// PATCHED FLAW 2: Environment variable setup.
// Create a .env file and add EXPO_PUBLIC_API_URL=https://swarm-api-super-agent-travily.onrender.com
// This prevents you from having to rewrite code when moving from local to production.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://swarm-api-super-agent-travily.onrender.com';

export default function App() {
  // --- AUTH STATE ---
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true); 

  // --- FORGOT PASSWORD STATE ---
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [newPasswordReset, setNewPasswordReset] = useState('');
  const [authError, setAuthError] = useState('');

  // --- CHAT STATE ---
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBooting, setIsBooting] = useState(true);

  // --- PAGINATION STATE ---
  const [offset, setOffset] = useState(0); 
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // --- ADMIN UPLOAD STATE ---
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [uploadContent, setUploadContent] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // === 1. BOOT SEQUENCE: SINGLE-SOURCE LISTENER ===
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      
      if (session?.user?.id && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        fetchHistory(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        // THE JANITOR: Wipes all memory and engages the lock
        setMessages([]); // Completely empty
        setIsBooting(true); // Lock the UI for the next user
        setInputText('');
        setOffset(0);              
        setHasMoreHistory(true);    
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // === 2. AUTHENTICATION FUNCTIONS ===
  async function signInWithEmail() {
    setAuthError(''); // Clear web errors
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setAuthLoading(false);

    if (error) {
      if (Platform.OS === 'web') {
        // Web: Show the inline red text
        setAuthError(error.message); 
      } else {
        // iOS/Android: Show the native OS popup
        Alert.alert('Login Failed', error.message); 
      }
    }
  }

  async function signUpWithEmail() {
    setAuthError(''); // 1. Always clear the slate
    const cleanEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // Check 1: Invalid Email Formatting
    if (!emailRegex.test(cleanEmail)) {
      if (Platform.OS === 'web') {
        setAuthError("Please enter a valid email address structure.");
      } else {
        Alert.alert("Invalid Email", "Please enter a valid email address structure.");
      }
      return;
    }

    setAuthLoading(true);
    const { error } = await supabase.auth.signUp({ email: cleanEmail, password });
    setAuthLoading(false);

    // Check 2: Supabase Rejection (e.g., email already in use)
    if (error) {
      if (Platform.OS === 'web') {
        setAuthError(error.message);
      } else {
        Alert.alert('Signup Failed', error.message);
      }
      return;
    }

    // Check 3: Absolute Success
    if (Platform.OS === 'web') {
      // Reusing the error state for a success message is a slight hack, 
      // but it gets the text on the screen without rewriting your UI tree.
      setAuthError("Success! Check your email for the verification link."); 
    } else {
      Alert.alert(
        'Verify Your Account', 
        'Account created successfully! We have sent a confirmation link to your email. Please verify it before trying to log in.'
      );
    }
    
    setIsLoginMode(true); 
  }

  async function handleSendOTP() {
    if (!email) {
      Alert.alert("Error", "Please enter your email address first.");
      return;
    }
    setAuthLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setAuthLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('OTP Sent', 'Check your email for the 6-digit recovery code.');
      setIsOtpSent(true); 
    }
  }

  async function handleVerifyAndReset() {
    if (!otpToken || !newPasswordReset) {
      Alert.alert("Error", "Please enter the OTP and your new password.");
      return;
    }
    
    setAuthLoading(true);
    
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),      
      token: otpToken.trim(),   
      type: 'recovery',
    });

    if (verifyError) {
      setAuthLoading(false);
      Alert.alert('Verification Failed', verifyError.message);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPasswordReset
    });

    setAuthLoading(false);

    if (updateError) {
      await supabase.auth.signOut(); 
      Alert.alert('Update Failed', updateError.message);
    } else {
      await supabase.auth.signOut(); 
      Alert.alert('Success', 'Password updated! You can now sign in.');
      setIsOtpSent(false);
      setIsForgotPasswordMode(false);
      setOtpToken('');
      setNewPasswordReset('');
      setPassword('');
    }
  }

  // === 3. THE DYNAMIC UPLOAD FUNCTION ===
  const handleUploadSubmit = async () => {
    if (!uploadContent.trim() || !adminPassword.trim()) {
      Alert.alert("Error", "Content and Password are required.");
      return;
    }

    setIsUploading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/upload-doc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_password: adminPassword,
          user_id: session?.user?.id, 
          content: uploadContent
        })
      });
      
      // PATCHED FLAW 3: Validate response before trying to parse JSON
      if (!response.ok) {
        throw new Error(`Server returned status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.status === 'success') {
        Alert.alert("Success", "Knowledge secured in vault.");
        setUploadContent('');
        setAdminPassword('');
        setIsModalVisible(false); 
      } else {
        Alert.alert("Upload Failed", result.message || "Unauthorized.");
      }
    } catch (error) {
      Alert.alert("Network Error", "Could not reach the server or invalid response.");
    } finally {
      setIsUploading(false);
    }
  };

  // === 4. FETCH HISTORY WITH PAGINATION ===
  const fetchHistory = async (userId: string, currentOffset: number = 0) => {
    // PATCHED FLAW 1: Guard clause prevents rapid-fire identical requests
    if ((!hasMoreHistory && currentOffset !== 0) || isLoadingMore) return; 

    if (currentOffset > 0) setIsLoadingMore(true);

    try {
      const response = await fetch(`${API_BASE_URL}/history/${userId}?limit=15&offset=${currentOffset}`);
      
      // PATCHED FLAW 3: Validate response
      if (!response.ok) {
         throw new Error(`Failed to fetch history. Status: ${response.status}`);
      }

      const result = await response.json();

      if (result.status === 'success') {
        const fetchedMessages = result.data;
        
        if (fetchedMessages.length < 15) setHasMoreHistory(false);

        const formattedHistory = fetchedMessages.map((msg: { role: string, content: string }, index: number) => ({
          id: `history-${currentOffset}-${index}`, 
          text: msg.content,
          sender: msg.role === 'assistant' ? 'ai' : 'user'
        }));

        if (currentOffset === 0) {
          const historyWithGreeting = [
            ...formattedHistory, 
            { id: '1', text: 'Hello User! Mera naam Jango hai, Kya seva kr skta hu?', sender: 'ai' }
          ];
          setMessages(historyWithGreeting);
        } else {
          setMessages(prev => [...prev, ...formattedHistory]);
        }
        
        setOffset(currentOffset + 15);
      }
    } catch (error) {
      console.log("Could not load history:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // === 5. CHAT SEND FUNCTION ===
  const handleSend = async () => {
    if (inputText.trim() === '' || !session?.user) return; 

    const userMessageText = inputText;
    
    // PATCHED FLAW 4: Robust Unique ID generation
    const uniqueUserId = Date.now().toString() + Math.random().toString(36).substring(7);
    const newUserMsg = { id: uniqueUserId, text: userMessageText, sender: 'user' };
    
    setMessages((prevMessages) => [newUserMsg, ...prevMessages]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: session.user.id,
          prompt: userMessageText 
        }),
      });

      // PATCHED FLAW 3: Validate response
      if (!response.ok) {
        throw new Error(`Chat API failed with status ${response.status}`);
      }

      const data = await response.json();
      
      // PATCHED FLAW 4: Robust Unique ID generation
      const uniqueAiId = Date.now().toString() + Math.random().toString(36).substring(7);
      const newAiMsg = { 
        id: uniqueAiId, 
        text: data.final_answer || "Sorry, koi text nahi mila.", 
        sender: 'ai' 
      };
      setMessages((prevMessages) => [newAiMsg, ...prevMessages]);

    } catch (error) {
      const errorUniqueId = Date.now().toString() + Math.random().toString(36).substring(7);
      const errorMsg = { id: errorUniqueId, text: "Sorry bhai, server se connection toot gaya! 🔌", sender: 'ai' };
      setMessages((prevMessages) => [errorMsg, ...prevMessages]);
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // RENDER 1: AUTHENTICATION SCREEN
  // ==========================================
  if (!session || !session.user || isForgotPasswordMode) {
    if (isForgotPasswordMode) {
      return (
        <View style={styles.authContainer}>
          <Text style={styles.authTitle}>Reset Password</Text>

          {/* INJECT THE ERROR DISPLAY HERE TOO */}
          {authError !== '' ? (
            <Text style={styles.errorText}>{authError}</Text>
          ) : null}
          
          {!isOtpSent ? (
            <>
              <Text style={styles.authSubtitle}>Enter your email to receive a 6-digit code.</Text>
              <TextInput
                style={styles.authInput}
                placeholder="Email address"
                placeholderTextColor="#888"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TouchableOpacity style={styles.primaryBtn} onPress={handleSendOTP} disabled={authLoading}>
                <Text style={styles.btnText}>{authLoading ? 'Sending...' : 'Send OTP'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.authSubtitle}>Enter the 6-digit code sent to your email.</Text>
              <TextInput
                style={styles.authInput}
                placeholder="6-Digit OTP"
                placeholderTextColor="#888"
                value={otpToken}
                onChangeText={setOtpToken}
                keyboardType="numeric"
              />
              <TextInput
                style={styles.authInput}
                placeholder="New Password (min 6 chars)"
                placeholderTextColor="#888"
                value={newPasswordReset}
                onChangeText={setNewPasswordReset}
                secureTextEntry={true}
              />
              <TouchableOpacity style={styles.primaryBtn} onPress={handleVerifyAndReset} disabled={authLoading}>
                <Text style={styles.btnText}>{authLoading ? 'Updating...' : 'Update Password'}</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity 
            style={styles.secondaryBtn} 
            onPress={() => {
              setIsForgotPasswordMode(false);
              setIsOtpSent(false);
              setOtpToken('');        
              setNewPasswordReset(''); 
            }} 
            disabled={authLoading}
          >
            <Text style={styles.secondaryBtnText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.authContainer}>
        {/* YOUR TEXT LOGO */}
        <Image 
          source={require('../../assets/images/jango-logo3.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.authTitle}>
          {isLoginMode ? 'Welcomes you!' : 'Create Account'}
        </Text>
        <Text style={styles.authSubtitle}>
          {isLoginMode ? 'Sign in to access your secure vault.' : 'Join the Jango network.'}
        </Text>

        {/* INJECT THE ERROR DISPLAY HERE */}
        {authError !== '' ? (
          <Text style={styles.errorText}>{authError}</Text>
        ) : null}
        
        <TextInput
          style={styles.authInput}
          placeholder="Email address"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.authInput}
          placeholder="Password (min 6 chars)"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={true}
        />
        
        <TouchableOpacity 
          style={styles.primaryBtn} 
          onPress={isLoginMode ? signInWithEmail : signUpWithEmail} 
          disabled={authLoading}
        >
          <Text style={styles.btnText}>
            {authLoading ? 'Loading...' : (isLoginMode ? 'Sign In' : 'Sign Up')}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.secondaryBtn} 
          onPress={() => setIsLoginMode(!isLoginMode)} 
          disabled={authLoading}
        >
          <Text style={styles.secondaryBtnText}>
            {isLoginMode ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
          </Text>
        </TouchableOpacity>

        {isLoginMode && (
          <TouchableOpacity 
            style={{ marginTop: 5, alignItems: 'center' }} 
            onPress={() => setIsForgotPasswordMode(true)} 
            disabled={authLoading}
          >
            <Text style={{ color: '#ff79c6', fontSize: 14, fontWeight: 'bold' }}>Forgot Password?</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ==========================================
  // RENDER 2: CHAT SCREEN 
  // ==========================================
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
      >   
        
        <View style={styles.header}>
          <Text style={styles.headerText}>Jango AI🧠</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
              style={[styles.headerAdminButton, { marginRight: 10 }]} 
              onPress={() => setIsModalVisible(true)}
            >
              <Text style={styles.headerAdminText}>⚙️Add</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.headerAdminButton, { backgroundColor: '#ff5555' }]} 
              onPress={() => supabase.auth.signOut()}
            >
              <Text style={styles.headerAdminText}>LogOut</Text>
            </TouchableOpacity>
          </View>
        </View>

        <FlatList 
          style={styles.chatArea}
          data={messages}
          inverted={true} 
          keyExtractor={(item) => item.id}
          renderItem={({ item: msg }) => (
            <View style={msg.sender === 'user' ? styles.userBubble : styles.aiBubble}>
              <Text style={msg.sender === 'user' ? styles.userText : styles.aiText}>
                {msg.text}
              </Text>
            </View>
          )}
          onEndReached={() => {
            if (session?.user?.id && hasMoreHistory && !isLoadingMore) {
              fetchHistory(session.user.id, offset);
            }
          }}
          onEndReachedThreshold={0.1} 
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator size="small" color="#bd93f9" style={{ marginVertical: 20 }} />
            ) : null
          }
          ListHeaderComponent={
            isLoading ? (
              <View style={styles.loadingBubble}>
                <ActivityIndicator size="small" color="#f4f2f7" />
                <Text style={styles.loadingText}>Jango soch raha hai...</Text>
              </View>
            ) : null
          }
        />

        <View style={styles.inputArea}>
          <TextInput
            style={styles.inputBox}
            placeholder="Type your message..."
            placeholderTextColor="#888"
            value={inputText}
            onChangeText={setInputText}
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={isLoading}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Knowledge Vault</Text>
            
            <Text style={styles.inputLabel}>Document Content:</Text>
            <TextInput
              style={[styles.modalInputBox, styles.modalTextArea]}
              placeholder="input data, facts, or rules here..."
              placeholderTextColor="#bfbfbf"
              multiline={true}
              numberOfLines={6}
              textAlignVertical="top" 
              secureTextEntry={false} 
              value={uploadContent}
              onChangeText={setUploadContent}
            />
            
            <Text style={styles.inputLabel}>Admin Password:</Text>
            <TextInput
              style={styles.modalInputBox}
              placeholder="Enter password..."
              placeholderTextColor="#bfbfbf"
              secureTextEntry={false} 
              value={adminPassword}
              onChangeText={setAdminPassword}
            />

            {isUploading ? (
              <ActivityIndicator size="large" color="#bd93f9" style={{ marginVertical: 10 }} />
            ) : (
              <View style={styles.modalButtonRow}>
                <TouchableOpacity 
                  style={[styles.sendButton, { backgroundColor: '#ff5555' }]} 
                  onPress={() => setIsModalVisible(false)}
                >
                  <Text style={styles.sendText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.sendButton, { backgroundColor: '#50fa7b' }]} 
                  onPress={handleUploadSubmit}
                >
                  <Text style={[styles.sendText, { color: '#282a36' }]}>Submit</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// === STYLESHEET ===
const styles = StyleSheet.create({
  // Chat Styles
  container: { flex: 1, backgroundColor: '#1e1e2e' },
  keyboardAvoid: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingTop: 50, backgroundColor: '#282a36', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#444' },
  headerText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  headerAdminButton: { backgroundColor: '#44475a', padding: 8, borderRadius: 5 },
  headerAdminText: { color: '#f8f8f2', fontSize: 14, fontWeight: 'bold' },
  chatArea: { flex: 1, padding: 15 },
  aiBubble: { backgroundColor: '#383a59', padding: 15, borderRadius: 10, marginBottom: 10, alignSelf: 'flex-start', maxWidth: '80%' },
  aiText: { color: '#fff', fontSize: 16 },
  userBubble: { backgroundColor: '#ff79c6', padding: 15, borderRadius: 10, marginBottom: 10, alignSelf: 'flex-end', maxWidth: '80%' },
  userText: { color: '#fff', fontSize: 16 },
  loadingBubble: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#383a59', padding: 10, borderRadius: 10, marginBottom: 10, alignSelf: 'flex-start' },
  loadingText: { color: '#bd93f9', marginLeft: 8, fontStyle: 'italic' },
  inputArea: { flexDirection: 'row', padding: 10, backgroundColor: '#282a36', alignItems: 'center' },
  inputBox: { flex: 1, backgroundColor: '#1e1e2e', color: '#fff', padding: 12, borderRadius: 10, fontSize: 16, borderWidth: 1, borderColor: '#44475a' },
  sendButton: { backgroundColor: '#bd93f9', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 25, marginLeft: 10, justifyContent: 'center', alignItems: 'center' },
  sendText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  
  // Modal Styles
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalView: { width: '90%', backgroundColor: '#282a36', borderRadius: 20, padding: 25, alignItems: 'stretch', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  modalInputBox: { backgroundColor: '#44475a', color: '#f8f8f2', padding: 12, borderRadius: 10, fontSize: 16, borderWidth: 1, borderColor: '#6272a4' },
  modalTextArea: { height: 140, textAlignVertical: 'top', marginBottom: 20 }, 
  inputLabel: { color: '#bd93f9', fontSize: 14, fontWeight: 'bold', marginBottom: 8, marginLeft: 5 }, 
  modalButtonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },

  // Auth Styles
  // --- AUTH STYLES (UPGRADED TO ZEN OCEAN) ---
  authContainer: { 
    flex: 1, 
    backgroundColor: '#0F172A', // Deep oceanic background (Calming & Professional)
    justifyContent: 'center', 
    padding: 20 
  },
  logoImage: {
    width: 250,
    height: 60,
    alignSelf: 'center',
    marginBottom: 30,
  },
  authTitle: { 
    color: '#d8e7edfa',          // Crisp white-off text for soft contrast
    fontSize: 23, 
    fontWeight: 'normal', 
    textAlign: 'center',
    fontStyle: 'italic', 
    marginBottom: 2 
  },
  authSubtitle: { 
    color: '#94A3B8',          // Muted steel text for secondary hierarchy
    fontSize: 16, 
    textAlign: 'center', 
    marginBottom: 40 
  },
  errorText: {
    color: '#e4eff3', 
    backgroundColor: 'rgba(244, 235, 235, 0.1)', 
    padding: 10,
    borderRadius: 8,
    textAlign: 'center',
    marginBottom: 15,
    fontWeight: '600',
    overflow: 'hidden', 
  },
  authInput: { 
    backgroundColor: '#1E293B', // Soft navy background for inputs (No harsh stark borders)
    color: '#F8FAFC', 
    padding: 15, 
    borderRadius: 12,          // Slightly rounder corners look more modern/relaxed
    fontSize: 16, 
    marginBottom: 15, 
    borderWidth: 1, 
    borderColor: '#334155'     // Subtle input border boundary
  },
  primaryBtn: { 
    backgroundColor: '#38BDF8', // Calm Sky Blue (Draws focus naturally without screaming)
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 10,
    shadowColor: '#38BDF8',     // Subtle professional glow instead of neon flat color
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnText: { 
    color: '#0F172A',          // Dark text on a light button provides clean readability
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  secondaryBtn: { 
    padding: 15, 
    borderRadius: 10, 
    alignItems: 'center', 
    marginTop: 15 
  },
  secondaryBtnText: { 
    color: '#38BDF8',          // Matching brand link color
    fontSize: 16, 
    fontWeight: '600' 
  }
});