#!/usr/bin/env python3
# Runs on the server only. Test email/codes/JWT/password never appear in stdout.
import json, secrets, time, urllib.request, urllib.error
from pathlib import Path
cfg=json.loads(Path('secrets/gateway.json').read_text())
root='http://127.0.0.1:15433'
def call(path,data=None,token=None,staging=True,method=None):
    headers={'Content-Type':'application/json','apikey':cfg['anonKey']}
    if staging: headers['x-nobi-staging-key']=cfg['stagingKey']
    if token: headers['Authorization']='Bearer '+token
    req=urllib.request.Request(root+path,data=None if data is None else json.dumps(data).encode(),headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=25) as r:
            raw=r.read(); return r.status,json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        return e.code,None
email='phase10-'+secrets.token_hex(5)+'@example.invalid'
password=secrets.token_urlsafe(24)
token=None
try:
    assert call('/auth/v1/signup',{'email':email,'password':password},staging=False)[0]==503
    assert call('/auth/v1/signup',{'email':email,'password':password})[0]==200
    assert call('/auth/v1/token?grant_type=password',{'email':email,'password':password})[0] in [400,401]
    code=None
    for _ in range(20):
        status,mail=call('/_staging/mail',{'email':email})
        if status==200: code=mail['code'];break
        time.sleep(.3)
    assert code, 'Test-only SMTP verification code unavailable'
    status,session=call('/auth/v1/verify',{'email':email,'token':code,'type':'email'})
    assert status==200 and session.get('access_token'), 'Email confirmation failed'
    token=session['access_token']
    assert call('/auth/v1/token?grant_type=password',{'email':email,'password':'incorrect-test-password'})[0] in [400,401]
    status,login=call('/auth/v1/token?grant_type=password',{'email':email,'password':password})
    assert status==200 and login.get('access_token'), 'Confirmed password login failed'
    token=login['access_token']
    time.sleep(1.2)
    assert call('/auth/v1/recover',{'email':email})[0]==200, 'Recovery email request failed'
    code=None
    for _ in range(20):
        status,mail=call('/_staging/mail',{'email':email})
        if status==200: code=mail['code'];break
        time.sleep(.3)
    assert code, 'Private recovery code unavailable'
    status,recovery=call('/auth/v1/verify',{'email':email,'token':code,'type':'recovery'})
    assert status==200 and recovery.get('access_token'), 'Recovery verification failed'
    token=recovery['access_token']
    password=secrets.token_urlsafe(24)
    assert call('/auth/v1/user',{'password':password},token=token,method='PUT')[0]==200
    status,login=call('/auth/v1/token?grant_type=password',{'email':email,'password':password})
    assert status==200 and login.get('access_token'), 'Recovered password login failed'
    token=login['access_token']
    assert call('/rest/v1/rpc/nobi_member_access',{},token='invalid')[0]==401
    assert call('/rest/v1/rpc/nobi_member_access',{'photo':'forbidden'},token=token)[0]==400
    status,features=call('/rest/v1/rpc/nobi_member_access',{},token=token)
    assert status==200 and features==['beautify','compose','share']
    assert call('/auth/v1/user',None,token=token)[0]==200
    assert call('/auth/v1/admin/users',None,token=token)[0]==404
    assert call('/functions/v1/nobi-delete-account',{'user_id':'forbidden'},token=token)[0]==400
    assert call('/functions/v1/nobi-delete-account',{},token=token)[0]==200
    assert call('/rest/v1/rpc/nobi_member_access',{},token=token)[0]==401
    token=None
    result={'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'service':'nobi-photos isolated Supabase Auth','registrationEnabledPublicly':False,'realAuthAndDatabase':True,'emailVerification':'private SMTP capture, example.invalid only','passwordLogin':True,'wrongPasswordDenied':True,'passwordRecovery':True,'unverifiedLoginDenied':True,'confirmedMembership':True,'forgedTokenDenied':True,'mediaPayloadDenied':True,'suppliedDeletionIdentityDenied':True,'adminRouteNotPublic':True,'deletedUserAccessDenied':True,'testAccountDeleted':True,'privatePhotos':False,'externalEmailsSent':False,'status':'passed'}
    Path('verification-result.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))
finally:
    if token: call('/functions/v1/nobi-delete-account',{},token=token)
