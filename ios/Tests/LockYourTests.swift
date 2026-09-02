import XCTest
@testable import LockYour

final class LockYourTests: XCTestCase {
    func testFullDurationFormattingDoesNotWrapAfterOneDay() {
        XCTAssertEqual(DurationText.full(90_061), "25:01:01")
    }

    func testFullDurationClampsNegativeValues() {
        XCTAssertEqual(DurationText.full(-10), "00:00:00")
    }

    func testCompletedSessionIdentityUsesClientSession() {
        let id = UUID()
        let session = CompletedLocalSession(
            clientSessionId: id,
            remoteSessionId: nil,
            startedAt: Date(timeIntervalSince1970: 1),
            endedAt: Date(timeIntervalSince1970: 10),
            stopIdempotencyKey: "stop-\(id.uuidString)"
        )
        XCTAssertEqual(session.id, id)
    }

    @MainActor
    func testEmailVerificationDeepLinkRequestsTheReturnRoute() {
        let model = AppModel()
        model.handleOpenURL(URL(string: "lockphone://verify-email")!)
        XCTAssertTrue(model.emailVerificationReturnRequested)

        model.consumeEmailVerificationReturn()
        XCTAssertFalse(model.emailVerificationReturnRequested)
    }
}
