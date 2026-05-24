import { Session } from '@supabase/supabase-js';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert,
  FlatList,
  KeyboardAvoidingView, Modal, Platform, SafeAreaView,
  StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { supabase } from './supabase'; // Ensure this path points to the file you created in Step 2

export default function App() {
  // --- AUTH STATE ---
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true); // NEW: Tracks which screen to show

  // --- FORGOT PASSWORD STATE ---
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [newPasswordReset, setNewPasswordReset] = useState('');

  // --- CHAT STATE ---
  const [messages, setMessages] = useState([
    { id: '1', text: 'Hello User! Mera naam Jango hai, Kya seva kr skta hu?', sender: 'ai' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // --- PAGINATION STATE ---
  const [offset, setOffset] = useState(0); 
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // --- ADMIN UPLOAD STATE ---
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [uploadContent, setUploadContent] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isUploading, setIsUploading] = useState(false);


// === 1. UPGRADED BOOT SEQUENCE: SINGLE-SOURCE LISTENER ===
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[AUTH EVENT] System detected state: ${event}`);
      setSession(session);
      
      if (session?.user?.id && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        console.log(`[AUTH SUCCESS] Launching history pull for user: ${session.user.id}`);
        fetchHistory(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        console.log("[AUTH LOGOUT] Clearing memory via Janitor sequence.");
        // THE JANITOR: Wipes all memory and resets the page counters to zero
        setMessages([
          { id: '1', text: 'Hello User! Mera naam Jango hai, Kya seva kr skta hu?', sender: 'ai' }
        ]);
        setInputText('');
        setOffset(0);               // <--- added
        setHasMoreHistory(true);    // <--- added 
      }
    });

    // Cleanup subscription when the app unmounts to prevent memory leaks
    return () => subscription.unsubscribe();
  }, []);

  // === 2. AUTHENTICATION FUNCTIONS ===
  async function signInWithEmail() {
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) Alert.alert('Login Failed', error.message);
    setAuthLoading(false);
  }

  async function signUpWithEmail() {
    // 1. Basic format validation check
    const cleanEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      Alert.alert("Invalid Email", "Please enter a valid email address structure (e.g., name@domain.com).");
      return;
    }

    setAuthLoading(true);
    
    // 2. Fire the signup to Supabase
    const { error } = await supabase.auth.signUp({ email: cleanEmail, password });
    
    setAuthLoading(false);

    if (error) {
      Alert.alert('Signup Failed', error.message);
      return;
    }

    // 3. The new verification UX rule
    Alert.alert(
      'Verify Your Account', 
      'Account created successfully! We have sent a confirmation link to your email. Please verify it before trying to log in.'
    );
    
    // 4. Switch the UI back to Login mode so they can log in AFTER clicking the email link
    setIsLoginMode(true); 
  }

  // === FORGOT PASSWORD FUNCTIONS ===
  async function handleSendOTP() {
    if (!email) {
      Alert.alert("Error", "Please enter your email address first.");
      return;
    }
    setAuthLoading(true);
    // THE FIX: Trim the email before requesting the reset
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
    
    // 1. Verify the OTP
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),      // THE FIX: Trim the email
      token: otpToken.trim(),   // THE FIX: Trim the pasted code
      type: 'recovery',
    });

    if (verifyError) {
      setAuthLoading(false);
      Alert.alert('Verification Failed', verifyError.message);
      return;
    }

    // 2. If OTP is valid, overwrite the password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPasswordReset
    });

    setAuthLoading(false);

    if (updateError) {
      // THE FIX: Forcefully destroy the temporary session if the password fails Supabase's rules
      await supabase.auth.signOut(); 
      
      Alert.alert('Update Failed', updateError.message);
    } else {
      // Force them out so they must log in with the newly minted password
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
      const response = await fetch("https://swarm-api-super-agent-travily.onrender.com/upload-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_password: adminPassword,
          user_id: session?.user?.id, // ARCHITECTURAL FIX: Attaching the real UUID to the vault upload
          content: uploadContent
        })
      });
      const result = await response.json();
      
      if (response.ok && result.status === 'success') {
        Alert.alert("Success", "Knowledge secured in vault.");
        setUploadContent('');
        setAdminPassword('');
        setIsModalVisible(false); 
      } else {
        Alert.alert("Upload Failed", result.message || "Unauthorized.");
      }
    } catch (error) {
      Alert.alert("Network Error", "Could not reach the server.");
    } finally {
      setIsUploading(false);
    }
  };

// === UPGRADED: FETCH HISTORY WITH PAGINATION ===
  const fetchHistory = async (userId: string, currentOffset: number = 0) => {
    if (!hasMoreHistory && currentOffset !== 0) return; // Stop if there is no more history

    if (currentOffset > 0) setIsLoadingMore(true);

    try {
      console.log(`[NETWORK] Fetching history from offset: ${currentOffset}`);
      const response = await fetch(`https://swarm-api-super-agent-travily.onrender.com/history/${userId}?limit=15&offset=${currentOffset}`);
      const result = await response.json();

      if (response.ok && result.status === 'success') {
        const fetchedMessages = result.data;
        
        // If the server returns less than 15, we hit the very beginning of the chat
        if (fetchedMessages.length < 15) setHasMoreHistory(false);

        const formattedHistory = fetchedMessages.map((msg: { role: string, content: string }, index: number) => ({
          id: `history-${currentOffset}-${index}`, 
          text: msg.content,
          sender: msg.role === 'assistant' ? 'ai' : 'user'
        }));

        if (currentOffset === 0) {
          // THE FIX: We must forcefully append the hardcoded greeting to the end of the fetched history
          // so it always appears at the very top of the chat, regardless of what the database says.
          const historyWithGreeting = [
            ...formattedHistory, 
            { id: '1', text: 'Hello User! Mera naam Jango hai, Kya seva kr skta hu?', sender: 'ai' }
          ];
          setMessages(historyWithGreeting);
        } else {
          // Scrolling up: Append older messages to the existing list
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

  // === 4. CHAT SEND FUNCTION ===
  const handleSend = async () => {
    if (inputText.trim() === '' || !session?.user) return; 

    const userMessageText = inputText;
    const newUserMsg = { id: Date.now().toString(), text: userMessageText, sender: 'user' };
    
    setMessages((prevMessages) => [newUserMsg, ...prevMessages]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await fetch('https://swarm-api-super-agent-travily.onrender.com/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: session.user.id, // ARCHITECTURAL FIX: Passing cryptographic UUID to the brain
          prompt: userMessageText 
        }),
      });

      const data = await response.json();
      const newAiMsg = { 
        id: Date.now().toString(), 
        text: data.final_answer || "Sorry, koi text nahi mila.", 
        sender: 'ai' 
      };
      setMessages((prevMessages) => [newAiMsg, ...prevMessages]);

    } catch (error) {
      const errorMsg = { id: Date.now().toString(), text: "Sorry bhai, server se connection toot gaya! 🔌", sender: 'ai' };
      setMessages((prevMessages) => [errorMsg, ...prevMessages]);
    } finally {
      setIsLoading(false);
    }
  };

// ==========================================
  // RENDER 1: AUTHENTICATION SCREEN
  // ==========================================
  if (!session || !session.user || isForgotPasswordMode) {
    
    // --- FORGOT PASSWORD UI ROUTE ---
    if (isForgotPasswordMode) {
      return (
        <View style={styles.authContainer}>
          <Text style={styles.authTitle}>Reset Password</Text>
          
          {!isOtpSent ? (
            // VIEW A: Ask for Email
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
            // VIEW B: Ask for OTP and New Password
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

          {/* Escape Hatch Button */}
          <TouchableOpacity 
            style={styles.secondaryBtn} 
            onPress={() => {
              setIsForgotPasswordMode(false);
              setIsOtpSent(false);
              setOtpToken('');         // THE FIX: Wipe the OTP memory
              setNewPasswordReset(''); // THE FIX: Wipe the password memory
            }} 
            disabled={authLoading}
          >
            <Text style={styles.secondaryBtnText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // --- STANDARD LOGIN / SIGNUP UI ROUTE ---
    return (
      <View style={styles.authContainer}>
        <Text style={styles.authTitle}>
          {isLoginMode ? 'Welcome!' : 'Create Account'}
        </Text>
        <Text style={styles.authSubtitle}>
          {isLoginMode ? 'Sign in to access your secure vault.' : 'Join the Jango network.'}
        </Text>
        
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

        {/* THE NEW TRIGGER FOR FORGOT PASSWORD */}
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
  // RENDER 2: CHAT SCREEN (If user is logged in)
  // ==========================================
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
      >   
        
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerText}>Jango AI🧠</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
              style={[styles.headerAdminButton, { marginRight: 10 }]} 
              onPress={() => setIsModalVisible(true)}
            >
              <Text style={styles.headerAdminText}>⚙️Add</Text>
            </TouchableOpacity>
            
            {/* NEW: Logout Button */}
            <TouchableOpacity 
              style={[styles.headerAdminButton, { backgroundColor: '#ff5555' }]} 
              onPress={() => supabase.auth.signOut()}
            >
              <Text style={styles.headerAdminText}>LogOut</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* CHAT AREA (UPGRADED TO INVERTED FLATLIST) */}
        <FlatList 
          style={styles.chatArea}
          data={messages}
          inverted={true} // THE MAGIC: Flips the list upside down! 0 is bottom.
          keyExtractor={(item) => item.id}
          
          // 1. How to draw the chat bubbles
          renderItem={({ item: msg }) => (
            <View style={msg.sender === 'user' ? styles.userBubble : styles.aiBubble}>
              <Text style={msg.sender === 'user' ? styles.userText : styles.aiText}>
                {msg.text}
              </Text>
            </View>
          )}

          // 2. What happens when the user scrolls upwards
          onEndReached={() => {
            if (session?.user?.id && hasMoreHistory && !isLoadingMore) {
              fetchHistory(session.user.id, offset);
            }
          }}
          onEndReachedThreshold={0.1} // Trigger when 10% away from the oldest message

          // 3. The Top Loading Spinner (for fetching older history)
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator size="small" color="#bd93f9" style={{ marginVertical: 20 }} />
            ) : null
          }

          // 4. The Bottom Loading Spinner (for Jango thinking)
          ListHeaderComponent={
            isLoading ? (
              <View style={styles.loadingBubble}>
                <ActivityIndicator size="small" color="#f4f2f7" />
                <Text style={styles.loadingText}>Jango soch raha hai...</Text>
              </View>
            ) : null
          }
        />

        {/* INPUT AREA */}
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

      {/* --- ADMIN VAULT MODAL --- */}
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
  authContainer: { flex: 1, backgroundColor: '#1e1e2e', justifyContent: 'center', padding: 20 },
  authTitle: { color: '#fff', fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  authSubtitle: { color: '#888', fontSize: 16, textAlign: 'center', marginBottom: 40 },
  authInput: { backgroundColor: '#282a36', color: '#fff', padding: 15, borderRadius: 10, fontSize: 16, marginBottom: 15, borderWidth: 1, borderColor: '#44475a' },
  primaryBtn: { backgroundColor: '#bd93f9', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  secondaryBtn: { padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  secondaryBtnText: { color: '#bd93f9', fontSize: 16, fontWeight: 'bold' }
});