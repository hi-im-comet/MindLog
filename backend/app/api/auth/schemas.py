import re
from marshmallow import Schema, fields, validate, validates, ValidationError


# 비밀번호 정책: 8자 이상, 영문·숫자·특수문자 각 1개 이상
PASSWORD_MIN_LEN = 8
PASSWORD_MAX_LEN = 128
PASSWORD_HAS_LETTER = re.compile(r'[A-Za-z]')
PASSWORD_HAS_DIGIT = re.compile(r'[0-9]')
PASSWORD_HAS_SPECIAL = re.compile(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?`~]')

PASSWORD_POLICY_MSG = (
    '비밀번호는 8자 이상이며, 영문·숫자·특수문자를 각각 1개 이상 포함해야 합니다.'
)


def validate_password_policy(value: str) -> None:
    if len(value) < PASSWORD_MIN_LEN or len(value) > PASSWORD_MAX_LEN:
        raise ValidationError(
            f'비밀번호는 {PASSWORD_MIN_LEN}자 이상 {PASSWORD_MAX_LEN}자 이하여야 합니다.'
        )
    if not PASSWORD_HAS_LETTER.search(value):
        raise ValidationError(PASSWORD_POLICY_MSG)
    if not PASSWORD_HAS_DIGIT.search(value):
        raise ValidationError(PASSWORD_POLICY_MSG)
    if not PASSWORD_HAS_SPECIAL.search(value):
        raise ValidationError(PASSWORD_POLICY_MSG)


class RegisterSchema(Schema):
    userNickname = fields.String(
        required=True,
        validate=validate.Length(min=1, max=100),
    )
    aiNickname = fields.String(
        required=True,
        validate=validate.Length(min=1, max=50),
    )
    email = fields.Email(required=True)
    password = fields.String(required=True)

    @validates('password')
    def validate_password(self, value):
        validate_password_policy(value)


class LoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.String(required=True)


class GoogleAuthSchema(Schema):
    credential = fields.String(required=True)


class RefreshSchema(Schema):
    refresh_token = fields.String(required=True)
