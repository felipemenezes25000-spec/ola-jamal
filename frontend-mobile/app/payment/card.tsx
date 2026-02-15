import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMercadoPagoPublicKey, fetchRequestById } from '../../lib/api';
import { apiClient } from '../../lib/api-client';
import { colors, spacing, typography } from '../../constants/theme';

const TOKEN_KEY = '@renoveja:auth_token';

function buildCardPaymentHtml(publicKey: string, amount: number, requestId: string, apiBase: string, authToken: string): string {
  const escaped = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
  const apiBaseClean = apiBase.replace(/\/$/, '');
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<script src="https://sdk.mercadopago.com/js/v2"></script>
<style>
*{box-sizing:border-box}body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#f5f5f5}
h2{font-size:18px;margin:0 0 12px 0;color:#333}
#container{min-height:360px;background:#fff;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
#saveCardRow{margin:12px 0;display:flex;align-items:center;gap:8px;font-size:14px;color:#555}
#saveCardRow input{width:18px;height:18px;accent-color:#008C52}
.error{color:#c62828;background:#ffebee;padding:12px;border-radius:8px;margin-top:12px;font-size:14px}
</style></head>
<body>
<div id="container"></div>
<div id="saveCardRow">
  <input type="checkbox" id="saveCard" name="saveCard" />
  <label for="saveCard">Salvar cartão para futuras compras</label>
</div>
<div id="error" class="error" style="display:none"></div>
<script>
(function(){
var publicKey='${escaped(publicKey)}';
var amount=${amount};
var requestId='${escaped(requestId)}';
var apiBase='${escaped(apiBaseClean)}';
var authToken='${escaped(authToken)}';

function showErr(msg){var e=document.getElementById('error');e.textContent=msg||'Erro';e.style.display='block';}
function hideErr(){document.getElementById('error').style.display='none';}

var mp=new MercadoPago(publicKey);
var bricksBuilder=mp.bricks();

var settings={
  initialization:{amount:amount},
  callbacks:{
    onReady:function(){hideErr();if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'READY'}));},
    onSubmit:function(formData,additionalData){
      return new Promise(function(resolve,reject){
        var tokenCard=formData.token||formData.Token;
        var paymentMethodId=formData.paymentMethodId||formData.payment_method_id;
        var installments=formData.installments!=null?formData.installments:(formData.Installments!=null?formData.Installments:1);
        var issuerId=formData.issuerId!=null?formData.issuerId:(formData.issuer_id!=null?formData.issuer_id:null);
        var paymentTypeId=(additionalData&&(additionalData.paymentTypeId||additionalData.payment_type_id))||'credit_card';
        var payerEmail=formData.email||(formData.payer&&formData.payer.email)||formData.cardholderEmail||formData.payerEmail||'';
        var payerCpf=formData.cardholderIdentificationNumber||(formData.payer&&formData.payer.identification&&formData.payer.identification.number)||formData.identificationNumber||formData.payerCpf||'';
        if(!tokenCard||!paymentMethodId){reject(new Error('Dados do cartão incompletos.'));return;}
        var saveCardEl=document.getElementById('saveCard');
        var saveCard=!!(saveCardEl&&saveCardEl.checked);
        var body={requestId:requestId,paymentMethod:paymentTypeId,token:tokenCard,paymentMethodId:String(paymentMethodId),installments:parseInt(installments,10)||1,saveCard:saveCard};
        if(issuerId!=null&&issuerId!=='')body.issuerId=parseInt(issuerId,10);
        if(payerEmail)body.payerEmail=payerEmail;
        if(payerCpf)body.payerCpf=payerCpf;
        fetch(apiBase+'/api/payments',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken},body:JSON.stringify(body)})
          .then(function(r){return r.json().then(function(d){return{ok:r.ok,data:d};});})
          .then(function(result){
            if(result.ok){
              if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'SUCCESS',payment:result.data}));
              resolve();
            }else{
              var msg=result.data.message||result.data.title||'Erro ao processar pagamento';
              showErr(msg);
              reject(new Error(msg));
            }
          })
          .catch(function(err){
            showErr(err.message||String(err));
            reject(err);
          });
      });
    },
    onError:function(err){var m=err&&(err.message||err.cause)||JSON.stringify(err);showErr('Erro: '+m);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'ERROR',message:m}));}
  }
};

bricksBuilder.create('cardPayment','container',settings).then(function(ctrl){window.cardPaymentBrickController=ctrl;}).catch(function(e){showErr('Falha ao carregar: '+e.message);});
})();
</script></body></html>`;
}

export default function CardPaymentScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const isFocused = useIsFocused();
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasNavigated = useRef(false);

  useEffect(() => {
    (async () => {
      if (!requestId || Array.isArray(requestId)) {
        setError('Solicitação inválida');
        setLoading(false);
        return;
      }
      const rid = Array.isArray(requestId) ? requestId[0] : requestId;
      try {
        const [keyRes, token] = await Promise.all([
          getMercadoPagoPublicKey(),
          AsyncStorage.getItem(TOKEN_KEY),
        ]);
        const publicKey = keyRes?.publicKey;
        if (!publicKey) {
          setError('Chave do Mercado Pago não configurada.');
          return;
        }
        if (!token) {
          setError('Faça login novamente.');
          return;
        }
        const request = await fetchRequestById(rid);
        const amount = request?.price ?? 100;
        const apiBase = apiClient.getBaseUrl();
        const htmlContent = buildCardPaymentHtml(publicKey, amount, rid, apiBase, token);
        setHtml(htmlContent);
      } catch (e: any) {
        setError(e.message || 'Erro ao carregar formulário.');
      } finally {
        setLoading(false);
      }
    })();
  }, [requestId]);

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    if (hasNavigated.current) return;
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'SUCCESS' && data.payment?.id) {
        hasNavigated.current = true;
        router.replace(`/payment/${data.payment.id}`);
      } else if (data.type === 'ERROR') {
        Alert.alert('Erro no pagamento', data.message || 'Tente novamente.');
      }
    } catch {}
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.primaryDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pagamento com Cartão</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando formulário...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !html) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.primaryDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pagamento com Cartão</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pagamento com Cartão</Text>
        <View style={{ width: 24 }} />
      </View>
      {isFocused && (
        <WebView
          source={{ html }}
          style={styles.webview}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          mixedContentMode="compatibility"
          scrollEnabled
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  headerTitle: { ...typography.h4, color: colors.primaryDarker },
  webview: { flex: 1, backgroundColor: 'transparent' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loadingText: { ...typography.body, color: colors.gray600 },
  errorBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  errorText: { ...typography.body, color: colors.error, textAlign: 'center', marginTop: spacing.md },
  backBtn: { marginTop: spacing.xl, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, backgroundColor: colors.primary, borderRadius: 8 },
  backBtnText: { ...typography.bodySemiBold, color: colors.white },
});
