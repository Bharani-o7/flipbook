// Flipbook — native app shell.
// Runs the Flipbook reader inside a full-screen web view, so one codebase works
// as a real app on iPhone (through Expo Go) and as an installable Android app.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { APP_URL, APP_NAME } from './config';

const url = String(APP_URL || '').trim();
// Plain http:// is allowed only for addresses that cannot leave the local
// network: loopback, the RFC1918 private ranges, link-local, and the
// carrier-NAT range Tailscale and phone hotspots hand out. Everything else
// must be https://, so a real deployment can't silently run unencrypted.
const LOCAL_HTTP = /^http:\/\/(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+)(:\d+)?(\/|$)/i;
const configured = /^https:\/\/\S+/i.test(url) || LOCAL_HTTP.test(url);
const origin = (() => { try { return new URL(url).origin; } catch (e) { return ''; } })();

// Reports the reader's current theme colour back to the native shell, so the
// area behind the notch and home bar matches the page instead of flashing white.
const INJECT = `(function(){
  function send(){
    try {
      var cs = getComputedStyle(document.documentElement);
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'theme',
        bg: cs.getPropertyValue('--bg').trim(),
        theme: document.documentElement.dataset.theme || 'light'
      }));
    } catch (e) {}
  }
  send();
  try { new MutationObserver(send).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) {}
})(); true;`;

export default function App() {
  const web = useRef(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [bg, setBg] = useState('#f6f4ef');
  const [dark, setDark] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [key, setKey] = useState(0);          // bumping this reloads the web view

  // Android hardware/gesture back: step back inside the reader before leaving the app
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && web.current) { web.current.goBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  const onMessage = useCallback(e => {
    try {
      const d = JSON.parse(e.nativeEvent.data);
      if (d && d.type === 'theme') {
        if (d.bg) setBg(d.bg);
        setDark(d.theme === 'dark');
      }
    } catch (err) {}
  }, []);

  // Keep reader navigation inside the app; send anything else to the system browser
  const onShouldStart = useCallback(req => {
    const target = req.url || '';
    if (target.startsWith('about:') || target.startsWith('blob:') || target.startsWith('data:')) return true;
    if (origin && target.startsWith(origin)) return true;
    Linking.openURL(target).catch(() => {});
    return false;
  }, []);

  const retry = () => { setFailed(false); setLoading(true); setKey(k => k + 1); };

  if (!configured) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.fill, { backgroundColor: '#f6f4ef' }]}>
          <StatusBar style="dark" />
          <View style={styles.center}>
            <Text style={styles.title}>Almost there</Text>
            <Text style={styles.body}>
              {APP_NAME} needs its web address before it can run.
            </Text>
            <Text style={styles.body}>
              Put {APP_NAME} online once (it's free — see Step 1 in README-APP.md), then open{' '}
              <Text style={styles.code}>config.js</Text> in this project and paste the address into{' '}
              <Text style={styles.code}>APP_URL</Text>. Save, and this screen will be replaced by the reader.
            </Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.fill, { backgroundColor: bg }]}>
        <StatusBar style={dark ? 'light' : 'dark'} backgroundColor={bg} />
        {failed ? (
          <View style={styles.center}>
            <Text style={[styles.title, dark && styles.titleDark]}>Can't reach {APP_NAME}</Text>
            <Text style={[styles.body, dark && styles.bodyDark]}>
              Check your internet connection and try again. Once {APP_NAME} has loaded on this device
              one time, it also opens offline.
            </Text>
            <Pressable style={styles.btn} onPress={retry} accessibilityRole="button">
              <Text style={styles.btnText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <WebView
              key={key}
              ref={web}
              source={{ uri: url }}
              style={{ flex: 1, backgroundColor: bg }}
              // reader behaviour
              injectedJavaScript={INJECT}
              onMessage={onMessage}
              onShouldStartLoadWithRequest={onShouldStart}
              onNavigationStateChange={s => setCanGoBack(s.canGoBack)}
              onLoadEnd={() => setLoading(false)}
              onError={() => { setLoading(false); setFailed(true); }}
              onHttpError={e => { if (e.nativeEvent.statusCode >= 500) { setLoading(false); setFailed(true); } }}
              // storage + files: the reader keeps books, notes and AI models on the device
              javaScriptEnabled
              domStorageEnabled
              cacheEnabled
              allowFileAccess
              originWhitelist={origin && origin.startsWith('http://') ? ['https://*', origin + '*'] : ['https://*']}
              // page turning uses horizontal swipes, so the browser's own swipe-back must stay off
              allowsBackForwardNavigationGestures={false}
              pullToRefreshEnabled={false}
              bounces={false}
              overScrollMode="never"
              setSupportMultipleWindows={false}
              mediaPlaybackRequiresUserAction={false}
              allowsInlineMediaPlayback
              androidLayerType="hardware"
            />
            {loading && (
              <View style={[styles.loading, { backgroundColor: bg }]} pointerEvents="none">
                <ActivityIndicator size="large" color="#c2562f" />
                <Text style={[styles.body, styles.loadingText, dark && styles.bodyDark]}>Opening {APP_NAME}…</Text>
              </View>
            )}
          </>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  title: { fontSize: 24, fontWeight: '700', color: '#1c1b1a', textAlign: 'center' },
  titleDark: { color: '#e9e6e1' },
  body: { fontSize: 15, lineHeight: 22, color: '#6f6a63', textAlign: 'center' },
  bodyDark: { color: '#9a958e' },
  code: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#c2562f' },
  btn: { marginTop: 8, backgroundColor: '#c2562f', paddingVertical: 12, paddingHorizontal: 26, borderRadius: 999 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  loading: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { marginTop: 4 }
});
