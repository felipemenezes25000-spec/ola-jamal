import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMercadoPagoPublicKey, fetchRequestById, fetchSavedCards } from '../../lib/api';
import { apiClient } from '../../lib/api-client';
import { colors, spacing, typography } from '../../constants/theme';

const TOKEN_KEY = '@renoveja:auth_token';

function buildCardPaymentHtml(publicKey: string, amount: number, requestId: string, apiBase: string, authToken: string, savedCards: { id: string; mpCardId: string; lastFour: string; brand: string }[]): string {
  const escaped = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
  const apiBaseClean = apiBase.replace(/\/$/, '');
  const savedCardsJson = JSON.stringify(savedCards);
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<script src="https://sdk.mercadopago.com/js/v2"></script>
<style>
*{box-sizing:border-box}body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#f8fafc}
#container{min-height:380px;background:#fff;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.06)}
#saveCardRow{margin:14px 0;display:flex;align-items:center;gap:10px;font-size:15px;color:#334155}
#saveCardRow input{width:20px;height:20px;accent-color:#0EA5E9}
.error{color:#dc2626;background:#fef2f2;padding:12px;border-radius:8px;margin-top:12px;font-size:14px}
.submitting{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(255,255,255,.9);display:flex;align-items:center;justify-content:center;z-index:9999}
.submitting span{font-size:16px;color:#334155;margin-top:12px}
.savedCards{margin-bottom:16px;padding:12px;background:#f1f5f9;border-radius:8px}
.savedCard{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fff;border-radius:8px;margin-bottom:8px;border:2px solid #e2e8f0;cursor:pointer}
.savedCard.selected{border-color:#0EA5E9;background:#eff6ff}
.savedCard:last-child{margin-bottom:0}
.useNew{font-size:14px;color:#64748b;margin-top:8px;cursor:pointer;text-decoration:underline}
</style></head>
<body>
<div id="savedCardsSection" style="display:none"></div>
<div id="formSection">
<div id="container"></div>
<div id="saveCardRow">
  <input type="checkbox" id="saveCard" name="saveCard" />
  <label for="saveCard">Salvar cartão para futuras compras</label>
</div>
</div>
<div id="error" class="error" style="display:none"></div>
<div id="submitting" class="submitting" style="display:none"><div style="text-align:center"><div style="width:40px;height:40px;border:3px solid #e2e8f0;border-top-color:#0EA5E9;border-radius:50%;animation:spin 0.8s linear infinite"></div><span>Processando pagamento...</span></div></div>
<style>@keyframes spin{to{transform:rotate(360deg)}}</style>
<script>
(function(){
var publicKey='${escaped(publicKey)}';
var amount=${amount};
var requestId='${escaped(requestId)}';
var apiBase='${escaped(apiBaseClean)}';
var authToken='${escaped(authToken)}';
var savedCards=${savedCardsJson};
var useSavedCard=null;

function showErr(msg){var e=document.getElementById('error');e.textContent=msg||'Erro';e.style.display='block';}
function hideErr(){document.getElementById('error').style.display='none';}
function setSubmitting(v){document.getElementById('submitting').style.display=v?'flex':'none';}
function showSavedCards(){
  if(savedCards.length===0)return;
  var sec=document.getElementById('savedCardsSection');
  sec.style.display='block';
  sec.innerHTML='<div class="savedCards"><strong style="font-size:13px;color:#64748b">CARTÕES SALVOS</strong>'+
    savedCards.map(function(c){
      return '<div class="savedCard" data-id="'+esc(c.id)+'" data-mpcardid="'+esc(c.mpCardId||'')+'" data-last="'+esc(c.lastFour)+'" data-brand="'+esc(c.brand)+'"><span style="font-size:18px">••••</span><span>'+esc(c.lastFour)+'</span><span style="color:#64748b;font-size:13px">'+esc(c.brand)+'</span></div>';
    }).join('')+
    '<div id="cvvSection" style="display:none;margin-top:12px"><label style="font-size:13px;color:#64748b">CVV do cartão salvo</label><div id="cvvFieldMount" style="min-height:50px;border:1px solid #e2e8f0;border-radius:8px;margin-top:6px"></div></div>'+
    '<div class="useNew" id="useNewCard">Usar outro cartão</div>'+
    '<button id="paySavedBtn" style="width:100%;margin-top:12px;padding:14px;background:#0EA5E9;color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer">Pagar com cartão salvo</button></div>';
  sec.querySelectorAll('.savedCard').forEach(function(el){
    el.addEventListener('click',function(){selectSavedCard(this);});
  });
  document.getElementById('useNewCard').addEventListener('click',function(){
    useSavedCard=null;
    document.querySelectorAll('.savedCard').forEach(function(e){e.classList.remove('selected');});
    document.getElementById('formSection').style.display='block';
    document.getElementById('cvvSection').style.display='none';
    if(window.savedCardCvvField){try{window.savedCardCvvField.unmount();}catch(e){} window.savedCardCvvField=null;}
  });
  document.getElementById('paySavedBtn').addEventListener('click',payWithSavedCard);
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function selectSavedCard(el){
  useSavedCard={id:el.dataset.id,mpCardId:el.dataset.mpcardid,lastFour:el.dataset.last,brand:el.dataset.brand};
  document.querySelectorAll('.savedCard').forEach(function(e){e.classList.remove('selected');});
  el.classList.add('selected');
  document.getElementById('formSection').style.display='none';
  document.getElementById('cvvSection').style.display='block';
  if(window.savedCardCvvField)window.savedCardCvvField.unmount();
  mp.fields.create('securityCode',{placeholder:'CVV'}).then(function(field){
    window.savedCardCvvField=field;
    field.mount('cvvFieldMount');
  }).catch(function(e){console.error('CVV field:',e);});
}

var mp=new MercadoPago(publicKey,{locale:'pt-BR'});
var bricksBuilder=mp.bricks();

var settings={
  customization:{visual:{style:{theme:'default'}}},
  initialization:{amount:amount},
  callbacks:{
    onReady:function(){hideErr();showSavedCards();if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'READY'}));},
    onSubmit:function(formData,additionalData){
      setSubmitting(true);
      hideErr();
      return new Promise(function(resolve,reject){
        var tokenCard=formData.token||formData.Token;
        var paymentMethodId=formData.paymentMethodId||formData.payment_method_id;
        var installments=formData.installments!=null?formData.installments:(formData.Installments!=null?formData.Installments:1);
        var issuerId=formData.issuerId!=null?formData.issuerId:(formData.issuer_id!=null?formData.issuer_id:null);
        var paymentTypeId=(additionalData&&(additionalData.paymentTypeId||additionalData.payment_type_id))||(formData.paymentTypeId||formData.payment_type_id)||'credit_card';
        var payerEmail=formData.email||(formData.payer&&formData.payer.email)||formData.cardholderEmail||formData.payerEmail||'';
        var payerCpf=(formData.payer&&formData.payer.identification&&formData.payer.identification.number)||formData.cardholderIdentificationNumber||formData.identificationNumber||formData.payerCpf||'';
        if(!tokenCard||!paymentMethodId){setSubmitting(false);reject(new Error('Dados do cartão incompletos.'));return;}
        var saveCardEl=document.getElementById('saveCard');
        var saveCard=!!(saveCardEl&&saveCardEl.checked);
        var body={requestId:requestId,paymentMethod:paymentTypeId,token:tokenCard,paymentMethodId:String(paymentMethodId),installments:parseInt(installments,10)||1,saveCard:saveCard};
        if(issuerId!=null&&issuerId!=='')body.issuerId=parseInt(issuerId,10);
        if(payerEmail)body.payerEmail=payerEmail;
        if(payerCpf)body.payerCpf=payerCpf;
        fetch(apiBase+'/api/payments',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken},body:JSON.stringify(body)})
          .then(function(r){return r.text().then(function(t){try{var d=JSON.parse(t);}catch(e){d={message:r.statusText||'Erro'};}return{ok:r.ok,data:d,status:r.status};});})
          .then(function(result){
            if(result.ok){
              if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'SUCCESS',payment:result.data}));
              resolve();
            }else{
              setSubmitting(false);
              var msg=result.data&&(result.data.message||result.data.title||result.data.detail)||('Erro '+result.status);
              showErr(msg);
              reject(new Error(msg));
            }
          })
          .catch(function(err){
            setSubmitting(false);
            showErr(err.message||String(err));
            if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'ERROR',message:err.message||String(err)}));
            reject(err);
          });
      });
    },
    onError:function(err){var m=err&&(err.message||(err.cause&&err.cause.message))||JSON.stringify(err);showErr('Erro: '+m);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'ERROR',message:m}));}
  }
};

function payWithSavedCard(){
  if(!useSavedCard){showErr('Selecione um cartão salvo ou use outro cartão.');return;}
  if(!useSavedCard.mpCardId){showErr('Dados do cartão incompletos.');return;}
  setSubmitting(true);
  hideErr();
  mp.fields.createCardToken({cardId:useSavedCard.mpCardId})
    .then(function(res){return res.id;})
    .catch(function(err){setSubmitting(false);showErr(err&&(err.message||err.cause&&err.cause.message)||'Preencha o CVV e tente novamente.');throw err;})
    .then(function(token){
      if(!token){setSubmitting(false);showErr('Não foi possível criar o token. Preencha o CVV.');return;}
      return fetch(apiBase+'/api/payments/saved-card',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken},body:JSON.stringify({requestId:requestId,savedCardId:useSavedCard.id,token:token})});
    })
    .then(function(r){if(!r)return null;return r.text().then(function(t){try{var d=JSON.parse(t);}catch(e){d={};}return{ok:r.ok,data:d};});})
    .then(function(result){
      setSubmitting(false);
      if(result&&result.ok&&result.data&&result.data.id){
        if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'SUCCESS',payment:result.data}));
      }else if(result){
        showErr(result.data&&(result.data.message||result.data.title)||'Erro ao processar pagamento.');
      }
    })
    .catch(function(err){if(!err)return;setSubmitting(false);showErr(err.message||'Erro de conexão.');});
}

bricksBuilder.create('cardPayment','container',settings).then(function(ctrl){window.cardPaymentBrickController=ctrl;}).catch(function(e){showErr('Falha ao carregar formulário: '+(e.message||e));});
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
        const [request, savedCards] = await Promise.all([
          fetchRequestById(rid),
          fetchSavedCards().catch(() => []),
        ]);
        const amount = request?.price ?? 100;
        const apiBase = apiClient.getBaseUrl();
        const cards = Array.isArray(savedCards) ? savedCards : [];
        const htmlContent = buildCardPaymentHtml(publicKey, amount, rid, apiBase, token, cards);
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
