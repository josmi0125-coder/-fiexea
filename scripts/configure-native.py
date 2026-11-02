"""Apply FIEXEA branding and callback declarations to generated Capacitor projects."""
from pathlib import Path
import json, plistlib, re
from PIL import Image

root=Path(__file__).resolve().parent.parent
config=json.loads((root/'capacitor.config.json').read_text())
scheme=config['appId']
manifest=root/'android/app/src/main/AndroidManifest.xml'
s=manifest.read_text().replace('android:allowBackup="true"','android:allowBackup="false"')
if 'android:scheme="'+scheme+'"' not in s:
 s=s.replace('        </activity>',f'''            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="{scheme}" android:host="auth" android:path="/callback" />
            </intent-filter>
        </activity>''')
manifest.write_text(s)
info=root/'ios/App/App/Info.plist'
data=plistlib.loads(info.read_bytes())
data['CFBundleDevelopmentRegion']='es'
data['CFBundleURLTypes']=[{'CFBundleURLName':scheme,'CFBundleURLSchemes':[scheme]}]
data['ITSAppUsesNonExemptEncryption']=False
info.write_bytes(plistlib.dumps(data,sort_keys=False))
privacy=root/'ios/App/App/PrivacyInfo.xcprivacy'
privacy.write_bytes(plistlib.dumps({
 'NSPrivacyTracking':False,
 'NSPrivacyAccessedAPITypes':[
  {'NSPrivacyAccessedAPIType':'NSPrivacyAccessedAPICategoryFileTimestamp','NSPrivacyAccessedAPITypeReasons':['C617.1']},
  {'NSPrivacyAccessedAPIType':'NSPrivacyAccessedAPICategoryUserDefaults','NSPrivacyAccessedAPITypeReasons':['CA92.1']}
 ]
},sort_keys=False))
pbx=root/'ios/App/App.xcodeproj/project.pbxproj'
s=pbx.read_text()
if 'PrivacyInfo.xcprivacy in Resources' not in s:
 s=s.replace('/* Begin PBXBuildFile section */','/* Begin PBXBuildFile section */\n\t\tF1E000000000000000000001 /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = F1E000000000000000000002 /* PrivacyInfo.xcprivacy */; };')
 s=s.replace('/* Begin PBXFileReference section */','/* Begin PBXFileReference section */\n\t\tF1E000000000000000000002 /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };')
 s=s.replace('504EC3131FED79650016851F /* Info.plist */,','504EC3131FED79650016851F /* Info.plist */,\n\t\t\t\tF1E000000000000000000002 /* PrivacyInfo.xcprivacy */,')
 s=s.replace('504EC3121FED79650016851F /* LaunchScreen.storyboard in Resources */,','504EC3121FED79650016851F /* LaunchScreen.storyboard in Resources */,\n\t\t\t\tF1E000000000000000000001 /* PrivacyInfo.xcprivacy in Resources */,')
pbx.write_text(s)
logo=Image.open(root/'fiexea-logo.png').convert('RGBA')
def branded(size,padding=.12):
 canvas=Image.new('RGB',(size,size),'white')
 inner=int(size*(1-2*padding));image=logo.copy();image.thumbnail((inner,inner),Image.Resampling.LANCZOS)
 canvas.paste(image,((size-image.width)//2,(size-image.height)//2),image)
 return canvas
ios_assets=root/'ios/App/App/Assets.xcassets'
branded(1024).save(ios_assets/'AppIcon.appiconset/AppIcon-512@2x.png',optimize=True)
for file in (ios_assets/'Splash.imageset').glob('*.png'):
 canvas=Image.new('RGB',(2732,2732),'white');small=branded(600)
 canvas.paste(small,((2732-600)//2,(2732-600)//2));canvas.save(file,optimize=True)
res=root/'android/app/src/main/res'
sizes={'mdpi':48,'hdpi':72,'xhdpi':96,'xxhdpi':144,'xxxhdpi':192}
for density,size in sizes.items():
 folder=res/f'mipmap-{density}'
 for name in ['ic_launcher.png','ic_launcher_round.png']:branded(size).save(folder/name,optimize=True)
 # Foreground adaptive layer must fit the central safe zone (66/108).
 fg=branded(int(size*108/48),.23);fg.save(folder/'ic_launcher_foreground.png',optimize=True)
for file in res.glob('drawable*/splash.png'):
 try:
  with Image.open(file) as old: width,height=old.size
 except Exception:
  # Repair an incomplete generated splash without depending on its previous bytes.
  width,height=(800,480) if 'land-hdpi' in file.parent.name else (320,480)
 canvas=Image.new('RGB',(width,height),'white');size=max(80,min(width,height)//3)
 icon=branded(size);canvas.paste(icon,((width-size)//2,(height-size)//2));canvas.save(file,optimize=True)
# Template drawable-v24 otherwise overrides the generated PNG foreground.
foreground=res/'drawable-v24/ic_launcher_foreground.xml'
foreground.write_text('<bitmap xmlns:android="http://schemas.android.com/apk/res/android" android:src="@mipmap/ic_launcher_foreground" android:gravity="center" />\n')
print('Native callbacks, privacy declarations, icons and splash screens configured.')
