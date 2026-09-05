# Samsung watch integration decision

Last reviewed: September 5, 2026

## Decision

Momentum's GitHub Pages PWA does not show a Health tab or a fake connection state in this release. A Galaxy Watch cannot grant its Samsung Health or Health Connect records directly to JavaScript running in a website.

If Momentum later ships an Android companion, the preferred integration is Health Connect. Samsung Health 6.22.5 and later can synchronize Galaxy Watch data to Health Connect through the phone. The companion should ask only for the data visible in the product: daily steps, resting heart rate, sleep duration, and recorded exercise sessions. It should use native, granular Android permissions and treat permission revocation as a normal disconnected state.

Samsung's Health Data SDK is another native-Android option, but public distribution requires Samsung partner registration with the application package name and signing certificate. Health Connect is the more interoperable starting point.

## Privacy and product boundaries

- Health data must remain private to the account. Friendship and challenge RPCs must never return it.
- A separate, explicit consent screen is required before the first sync. Each data category must have a plain explanation and may be revoked independently where the platform permits.
- Momentum should display source device/app and last synchronized time. Watch-to-phone sync is not guaranteed to be real time.
- Sensor data must not affect workout completions, challenge scores, reminders, or medical conclusions.
- Before collecting health data, update the Privacy policy, document deletion/export behavior, complete applicable Google Play health declarations, and reassess FTC Health Breach Notification Rule obligations.

## Authoritative references

- [Samsung Health Connect FAQ](https://developer.samsung.com/health/health-connect-faq.html)
- [Samsung Health Data SDK FAQ](https://developer.samsung.com/health/data/faq.html)
- [Android Health Connect vitals guidance](https://developer.android.com/health-and-fitness/health-connect/experiences/vitals)
- [FTC Mobile Health Apps Interactive Tool](https://www.ftc.gov/business-guidance/resources/mobile-health-apps-interactive-tool)
